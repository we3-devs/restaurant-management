import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutletsService } from '../outlets/outlets.service';
import type {
  DashboardBreakdown,
  DashboardCharts,
  DashboardInventoryActivity,
  DashboardStats,
  ResolvedRange,
} from '../dashboard/dashboard.service';
import { DEFAULT_RANGE_DAYS } from '../dashboard/dashboard.constants';
import { DashboardComputeService } from './dashboard-compute.service';
import { DashboardBreakdownCache } from './entities/dashboard-breakdown-cache.entity';
import { DashboardChartCache } from './entities/dashboard-chart-cache.entity';
import { DashboardInventoryCache } from './entities/dashboard-inventory-cache.entity';
import { DashboardStatsCache } from './entities/dashboard-stats-cache.entity';

/** Sentinel PK for the unfiltered "all outlets" cache row. */
const ALL_OUTLETS_SENTINEL = 0;

/**
 * Precomputed-cache read/write layer behind the dashboard's default date
 * range. Reads are a single indexed SELECT; on a miss (first request for an
 * outlet, or a range-bound row whose window has aged past today) it falls
 * back to computing once via DashboardComputeService and upserting the
 * result, so subsequent requests hit the cache. Custom date ranges never
 * reach this service — DashboardService routes those straight to
 * DashboardComputeService.
 */
@Injectable()
export class DashboardCacheService {
  private readonly logger = new Logger(DashboardCacheService.name);

  constructor(
    @InjectRepository(DashboardStatsCache)
    private readonly statsRepo: Repository<DashboardStatsCache>,
    @InjectRepository(DashboardChartCache)
    private readonly chartRepo: Repository<DashboardChartCache>,
    @InjectRepository(DashboardBreakdownCache)
    private readonly breakdownRepo: Repository<DashboardBreakdownCache>,
    @InjectRepository(DashboardInventoryCache)
    private readonly inventoryRepo: Repository<DashboardInventoryCache>,
    private readonly compute: DashboardComputeService,
    private readonly outletsService: OutletsService,
  ) {}

  /** The default range the cache represents: rolling N days ending now, same as DashboardService.resolveRange's no-params default. */
  defaultRange(outletId?: number): ResolvedRange {
    const to = new Date();
    const from = new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60_000);
    return { outletId, from, to };
  }

  private pk(outletId?: number): number {
    return outletId ?? ALL_OUTLETS_SENTINEL;
  }

  /** A range-bound cache row is stale once its `to` boundary is no longer "today" — the 30-day window has silently drifted forward even without any write. */
  private isStale(rangeTo: Date): boolean {
    const today = new Date().toDateString();
    return new Date(rangeTo).toDateString() !== today;
  }

  async getStats(outletId?: number): Promise<DashboardStats> {
    const pk = this.pk(outletId);
    const row = await this.statsRepo.findOne({ where: { outletId: pk } });
    if (row && !this.isStale(row.rangeTo)) return row.payload;
    return this.rebuildStats(outletId);
  }

  async getCharts(outletId?: number): Promise<DashboardCharts> {
    const pk = this.pk(outletId);
    const row = await this.chartRepo.findOne({ where: { outletId: pk } });
    if (row && !this.isStale(row.rangeTo)) return row.payload;
    return this.rebuildCharts(outletId);
  }

  async getBreakdown(outletId?: number): Promise<DashboardBreakdown> {
    const pk = this.pk(outletId);
    const row = await this.breakdownRepo.findOne({ where: { outletId: pk } });
    if (row && !this.isStale(row.rangeTo)) return row.payload;
    return this.rebuildBreakdown(outletId);
  }

  async getInventoryActivity(
    outletId?: number,
  ): Promise<DashboardInventoryActivity> {
    const pk = this.pk(outletId);
    const row = await this.inventoryRepo.findOne({ where: { outletId: pk } });
    if (row) return row.payload;
    return this.rebuildInventoryActivity(outletId);
  }

  private async rebuildStats(outletId?: number): Promise<DashboardStats> {
    const range = this.defaultRange(outletId);
    const payload = await this.compute.computeStats(range);
    await this.statsRepo.upsert(
      {
        outletId: this.pk(outletId),
        rangeFrom: range.from,
        rangeTo: range.to,
        payload,
      },
      ['outletId'],
    );
    return payload;
  }

  private async rebuildCharts(outletId?: number): Promise<DashboardCharts> {
    const range = this.defaultRange(outletId);
    const payload = await this.compute.computeCharts(range);
    await this.chartRepo.upsert(
      {
        outletId: this.pk(outletId),
        rangeFrom: range.from,
        rangeTo: range.to,
        payload,
      },
      ['outletId'],
    );
    return payload;
  }

  private async rebuildBreakdown(
    outletId?: number,
  ): Promise<DashboardBreakdown> {
    const range = this.defaultRange(outletId);
    const payload = await this.compute.computeBreakdown(range);
    await this.breakdownRepo.upsert(
      {
        outletId: this.pk(outletId),
        rangeFrom: range.from,
        rangeTo: range.to,
        payload,
      },
      ['outletId'],
    );
    return payload;
  }

  private async rebuildInventoryActivity(
    outletId?: number,
  ): Promise<DashboardInventoryActivity> {
    const range = this.defaultRange(outletId);
    const payload = await this.compute.computeInventoryActivity(range);
    await this.inventoryRepo.upsert(
      { outletId: this.pk(outletId), payload },
      ['outletId'],
    );
    return payload;
  }

  /** Recomputes and upserts every cache section for one outlet. Used by invalidation jobs, the nightly reconciliation job, and manual admin rebuilds. */
  async rebuildOutlet(outletId?: number): Promise<void> {
    await Promise.all([
      this.rebuildStats(outletId),
      this.rebuildCharts(outletId),
      this.rebuildBreakdown(outletId),
      this.rebuildInventoryActivity(outletId),
    ]);
  }

  /** Recomputes only the given sections for one outlet — what the write-path invalidation jobs use, since a single order/payment/stock write rarely affects all 4 caches. */
  async rebuildSections(
    outletId: number | null,
    sections: Array<'stats' | 'charts' | 'breakdown' | 'inventory'>,
  ): Promise<void> {
    // Some source tables (warehouse stock, wastages) don't carry outletId
    // directly on the row, so the subscriber can't attribute the write to a
    // single outlet — in that case, rebuild the affected sections for every
    // outlet rather than silently leaving stale caches elsewhere.
    if (outletId === null) {
      const outlets = await this.outletsService.findAllUnpaginated();
      await Promise.all([
        this.rebuildSectionsForOutlet(undefined, sections),
        ...outlets.map((outlet) =>
          this.rebuildSectionsForOutlet(outlet.id, sections),
        ),
      ]);
      return;
    }
    await this.rebuildSectionsForOutlet(outletId, sections);
  }

  private async rebuildSectionsForOutlet(
    outletId: number | undefined,
    sections: Array<'stats' | 'charts' | 'breakdown' | 'inventory'>,
  ): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    if (sections.includes('stats')) jobs.push(this.rebuildStats(outletId));
    if (sections.includes('charts')) jobs.push(this.rebuildCharts(outletId));
    if (sections.includes('breakdown'))
      jobs.push(this.rebuildBreakdown(outletId));
    if (sections.includes('inventory'))
      jobs.push(this.rebuildInventoryActivity(outletId));
    await Promise.all(jobs);
  }

  /** Rebuilds every outlet's cache plus the unfiltered "all outlets" row — used by the nightly scheduler and available for manual/migration backfill. */
  async rebuildAll(): Promise<void> {
    const outlets = await this.outletsService.findAllUnpaginated();
    await Promise.all([
      this.rebuildOutlet(undefined),
      ...outlets.map((outlet) => this.rebuildOutlet(outlet.id)),
    ]);
    this.logger.log(`Rebuilt dashboard cache for ${outlets.length} outlet(s)`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutletsService } from '../outlets/outlets.service';
import { SettingsService } from '../settings/settings.service';
import {
  PeriodInsight,
  type PeriodType,
} from './entities/period-insight.entity';
import { PeriodInsightsComputeService } from './period-insights-compute.service';
import {
  type PeriodWindow,
  dayWindows,
  lastCompletedDay,
  lastCompletedMonth,
  lastCompletedWeek,
  monthWindows,
  periodLabel,
  toDateOnlyString,
  weekWindows,
} from './period-insights.util';

/** Sentinel PK for the unfiltered "all outlets" row, matching dashboard-cache. */
const ALL_OUTLETS_SENTINEL = 0;

@Injectable()
export class PeriodInsightsService {
  private readonly logger = new Logger(PeriodInsightsService.name);

  private async getBusinessTimezone(): Promise<string> {
    const business = await this.settings.getBusinessSettings();
    return typeof business.timezone === 'string' && business.timezone ? business.timezone : 'Asia/Kathmandu';
  }

  constructor(
    @InjectRepository(PeriodInsight)
    private readonly repo: Repository<PeriodInsight>,
    private readonly compute: PeriodInsightsComputeService,
    private readonly outletsService: OutletsService,
    private readonly settings: SettingsService,
  ) {}

  async list(params: {
    outletId?: number;
    periodType: PeriodType;
    limit?: number;
  }): Promise<PeriodInsight[]> {
    return this.repo.find({
      where: {
        outletId: params.outletId ?? ALL_OUTLETS_SENTINEL,
        periodType: params.periodType,
      },
      order: { periodStart: 'DESC' },
      take: params.limit ?? 30,
    });
  }

  /** Computes and upserts one outlet's rollup for a single closed period window. */
  private async rollupOne(
    outletId: number | undefined,
    window: PeriodWindow,
    timeZone: string,
  ): Promise<void> {
    const payload = await this.compute.computePayload({
      outletId,
      from: window.periodStart,
      to: window.periodEnd,
    });
    await this.repo.upsert(
      {
        outletId: outletId ?? ALL_OUTLETS_SENTINEL,
        periodType: window.periodType,
        periodStart: toDateOnlyString(window.periodStart, timeZone),
        periodEnd: toDateOnlyString(window.periodEnd, timeZone),
        periodLabel: periodLabel(window, timeZone),
        payload,
      },
      ['outletId', 'periodType', 'periodStart'],
    );
  }

  /**
   * Rolls up one period window for every outlet plus the unfiltered "all
   * outlets" row. Sequential, not Promise.all â€” a full-history backfill can
   * fan this out across many windows already, and running every outlet's
   * queries concurrently on top of that exhausts the connection pool
   * (Supabase's pooler in particular).
   */
  private async rollupAllOutlets(window: PeriodWindow, timeZone: string): Promise<void> {
    const outlets = await this.outletsService.findAllUnpaginated();
    await this.rollupOne(undefined, window, timeZone);
    for (const outlet of outlets) {
      await this.rollupOne(outlet.id, window, timeZone);
    }
    this.logger.log(
      `Rolled up ${window.periodType} insight (${toDateOnlyString(window.periodStart)}) for ${outlets.length} outlet(s)`,
    );
  }

  /** Rolls up yesterday's daily period for every outlet. Safe to call daily. */
  async rollupDaily(now = new Date()): Promise<void> {
    const timeZone = await this.getBusinessTimezone();
    await this.rollupAllOutlets(lastCompletedDay(now, timeZone), timeZone);
  }

  /** Rolls up the most recently completed Mon-Sun week for every outlet. Safe to call daily â€” it's a no-op re-upsert once already computed. */
  async rollupWeekly(now = new Date()): Promise<void> {
    const timeZone = await this.getBusinessTimezone();
    await this.rollupAllOutlets(lastCompletedWeek(now, timeZone), timeZone);
  }

  /** Rolls up the most recently completed calendar month for every outlet. Safe to call daily â€” it's a no-op re-upsert once already computed. */
  async rollupMonthly(now = new Date()): Promise<void> {
    const timeZone = await this.getBusinessTimezone();
    await this.rollupAllOutlets(lastCompletedMonth(now, timeZone), timeZone);
  }

  /** Runs all three rollups â€” used by the nightly scheduler and available for manual/migration backfill. */
  async rollupAll(now = new Date()): Promise<void> {
    await Promise.all([
      this.rollupDaily(now),
      this.rollupWeekly(now),
      this.rollupMonthly(now),
    ]);
  }

  /**
   * One-time full-history backfill: rolls up every completed daily/weekly/
   * monthly window from `since` up to `now`, for every outlet. Used to make
   * pre-existing order history operational once, after which the nightly
   * scheduler keeps things current on its own.
   */
  async backfillHistory(since: Date, now = new Date()): Promise<void> {
    const timeZone = await this.getBusinessTimezone();
    const windows = [
      ...dayWindows(since, now, timeZone),
      ...weekWindows(since, now, timeZone),
      ...monthWindows(since, now, timeZone),
    ];
    for (const window of windows) {
      await this.rollupAllOutlets(window, timeZone);
    }
    this.logger.log(
      `Backfilled ${windows.length} AD period insight window(s) since ${toDateOnlyString(since)}`,
    );
  }
}

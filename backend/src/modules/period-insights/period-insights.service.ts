import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutletsService } from '../outlets/outlets.service';
import {
  PeriodInsight,
  type PeriodType,
} from './entities/period-insight.entity';
import { PeriodInsightsComputeService } from './period-insights-compute.service';
import {
  type PeriodWindow,
  lastCompletedDay,
  lastCompletedMonth,
  lastCompletedWeek,
  periodLabel,
  toDateOnlyString,
} from './period-insights.util';

/** Sentinel PK for the unfiltered "all outlets" row, matching dashboard-cache. */
const ALL_OUTLETS_SENTINEL = 0;

@Injectable()
export class PeriodInsightsService {
  private readonly logger = new Logger(PeriodInsightsService.name);

  constructor(
    @InjectRepository(PeriodInsight)
    private readonly repo: Repository<PeriodInsight>,
    private readonly compute: PeriodInsightsComputeService,
    private readonly outletsService: OutletsService,
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
        periodStart: toDateOnlyString(window.periodStart),
        periodEnd: toDateOnlyString(window.periodEnd),
        periodLabel: periodLabel(window),
        payload,
      },
      ['outletId', 'periodType', 'periodStart'],
    );
  }

  /** Rolls up one period window for every outlet plus the unfiltered "all outlets" row. */
  private async rollupAllOutlets(window: PeriodWindow): Promise<void> {
    const outlets = await this.outletsService.findAllUnpaginated();
    await Promise.all([
      this.rollupOne(undefined, window),
      ...outlets.map((outlet) => this.rollupOne(outlet.id, window)),
    ]);
    this.logger.log(
      `Rolled up ${window.periodType} insight (${toDateOnlyString(window.periodStart)}) for ${outlets.length} outlet(s)`,
    );
  }

  /** Rolls up yesterday's daily period for every outlet. Safe to call daily. */
  async rollupDaily(now = new Date()): Promise<void> {
    await this.rollupAllOutlets(lastCompletedDay(now));
  }

  /** Rolls up the most recently completed Mon-Sun week for every outlet. Safe to call daily — it's a no-op re-upsert once already computed. */
  async rollupWeekly(now = new Date()): Promise<void> {
    await this.rollupAllOutlets(lastCompletedWeek(now));
  }

  /** Rolls up the most recently completed calendar month for every outlet. Safe to call daily — it's a no-op re-upsert once already computed. */
  async rollupMonthly(now = new Date()): Promise<void> {
    await this.rollupAllOutlets(lastCompletedMonth(now));
  }

  /** Runs all three rollups — used by the nightly scheduler and available for manual/migration backfill. */
  async rollupAll(now = new Date()): Promise<void> {
    await Promise.all([
      this.rollupDaily(now),
      this.rollupWeekly(now),
      this.rollupMonthly(now),
    ]);
  }

  /**
   * Backfills daily rollups for the last N completed days (and, in passing,
   * whichever weekly/monthly windows those days belong to) — for seeding
   * history after this feature is first deployed.
   */
  async backfillDays(days: number): Promise<void> {
    for (let i = days; i >= 1; i -= 1) {
      const asOf = new Date(Date.now() - (i - 1) * 24 * 60 * 60_000);
      await this.rollupAllOutlets(lastCompletedDay(asOf));
    }
  }
}

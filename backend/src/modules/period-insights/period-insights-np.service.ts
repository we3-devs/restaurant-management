import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutletsService } from '../outlets/outlets.service';
import {
  PeriodInsightNp,
  type PeriodType,
} from './entities/period-insight-np.entity';
import { PeriodInsightsComputeService } from './period-insights-compute.service';
import { toDateOnlyString } from './period-insights.util';
import {
  type PeriodWindowNp,
  dayWindowsNp,
  lastCompletedDayNp,
  lastCompletedMonthNp,
  lastCompletedWeekNp,
  monthWindowsNp,
  periodLabelNp,
  weekWindowsNp,
} from './period-insights-np.util';

/** Sentinel PK for the unfiltered "all outlets" row, matching dashboard-cache. */
const ALL_OUTLETS_SENTINEL = 0;

/** BS (Bikram Sambat) counterpart of PeriodInsightsService — see that class for the AD version. */
@Injectable()
export class PeriodInsightsNpService {
  private readonly logger = new Logger(PeriodInsightsNpService.name);

  constructor(
    @InjectRepository(PeriodInsightNp)
    private readonly repo: Repository<PeriodInsightNp>,
    private readonly compute: PeriodInsightsComputeService,
    private readonly outletsService: OutletsService,
  ) {}

  async list(params: {
    outletId?: number;
    periodType: PeriodType;
    limit?: number;
  }): Promise<PeriodInsightNp[]> {
    return this.repo.find({
      where: {
        outletId: params.outletId ?? ALL_OUTLETS_SENTINEL,
        periodType: params.periodType,
      },
      order: { periodStartBs: 'DESC' },
      take: params.limit ?? 30,
    });
  }

  private async rollupOne(
    outletId: number | undefined,
    window: PeriodWindowNp,
  ): Promise<void> {
    const payload = await this.compute.computePayload({
      outletId,
      from: window.periodStartAd,
      to: window.periodEndAd,
    });
    await this.repo.upsert(
      {
        outletId: outletId ?? ALL_OUTLETS_SENTINEL,
        periodType: window.periodType,
        periodStartBs: window.periodStartBs,
        periodEndBs: window.periodEndBs,
        periodStartAd: toDateOnlyString(window.periodStartAd),
        periodEndAd: toDateOnlyString(window.periodEndAd),
        periodLabel: periodLabelNp(window),
        payload,
      },
      ['outletId', 'periodType', 'periodStartBs'],
    );
  }

  /** Sequential, not Promise.all — see the AD PeriodInsightsService.rollupAllOutlets for why. */
  private async rollupAllOutlets(window: PeriodWindowNp): Promise<void> {
    const outlets = await this.outletsService.findAllUnpaginated();
    await this.rollupOne(undefined, window);
    for (const outlet of outlets) {
      await this.rollupOne(outlet.id, window);
    }
    this.logger.log(
      `Rolled up ${window.periodType} NP insight (${window.periodStartBs}) for ${outlets.length} outlet(s)`,
    );
  }

  /** Rolls up yesterday's daily period for every outlet. Safe to call daily. */
  async rollupDaily(now = new Date()): Promise<void> {
    await this.rollupAllOutlets(lastCompletedDayNp(now));
  }

  /** Rolls up the most recently completed Sun-Sat week for every outlet. Safe to call daily — no-op re-upsert once already computed. */
  async rollupWeekly(now = new Date()): Promise<void> {
    await this.rollupAllOutlets(lastCompletedWeekNp(now));
  }

  /** Rolls up the most recently completed BS calendar month for every outlet. Safe to call daily — no-op re-upsert once already computed. */
  async rollupMonthly(now = new Date()): Promise<void> {
    await this.rollupAllOutlets(lastCompletedMonthNp(now));
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
   * One-time full-history backfill: rolls up every completed daily/weekly/
   * monthly BS window from `since` up to `now`, for every outlet. See
   * PeriodInsightsService.backfillHistory for the AD counterpart.
   */
  async backfillHistory(since: Date, now = new Date()): Promise<void> {
    const windows = [
      ...dayWindowsNp(since, now),
      ...weekWindowsNp(since, now),
      ...monthWindowsNp(since, now),
    ];
    for (const window of windows) {
      await this.rollupAllOutlets(window);
    }
    this.logger.log(
      `Backfilled ${windows.length} BS period insight window(s) since ${toDateOnlyString(since)}`,
    );
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { PeriodInsightNp } from './entities/period-insight-np.entity';
import { PeriodInsight } from './entities/period-insight.entity';
import { PeriodInsightsNpService } from './period-insights-np.service';
import { PeriodInsightsService } from './period-insights.service';

export interface BackfillStatus {
  running: boolean;
  since: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

/**
 * One-time "process all old data" backfill for period_insights /
 * period_insights_np. Finds the earliest order ever placed and rolls up
 * every daily/weekly/monthly window (both AD and BS calendars) between
 * then and now. Runs in the background — ongoing coverage after this is
 * handled by PeriodInsightsScheduler, so this only ever needs to run once
 * per deployment (or after a data import).
 */
@Injectable()
export class PeriodInsightsBackfillService {
  private readonly logger = new Logger(PeriodInsightsBackfillService.name);
  private status: BackfillStatus = {
    running: false,
    since: null,
    startedAt: null,
    finishedAt: null,
    error: null,
  };

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(PeriodInsight)
    private readonly periodInsightRepo: Repository<PeriodInsight>,
    @InjectRepository(PeriodInsightNp)
    private readonly periodInsightNpRepo: Repository<PeriodInsightNp>,
    private readonly periodInsightsService: PeriodInsightsService,
    private readonly periodInsightsNpService: PeriodInsightsNpService,
  ) {}

  getStatus(): BackfillStatus {
    return this.status;
  }

  /**
   * Auto-runs the full-history backfill the first time this app ever boots
   * against a database with orders but no period_insights rows yet — so
   * "process all old data" happens on its own without an admin having to
   * find and click the button. A no-op on every later boot, since by then
   * rows exist (the nightly scheduler keeps adding to them regardless).
   */
  async runOnceIfNeverRun(): Promise<void> {
    const [adCount, npCount] = await Promise.all([
      this.periodInsightRepo.count(),
      this.periodInsightNpRepo.count(),
    ]);
    if (adCount > 0 || npCount > 0) return;
    this.logger.log(
      'No period insights found yet — running the one-time full-history backfill.',
    );
    this.start();
  }

  /** Kicks off the backfill in the background and returns immediately. */
  start(): BackfillStatus {
    if (this.status.running) {
      throw new BadRequestException(
        'A period insights backfill is already running.',
      );
    }
    this.status = {
      running: true,
      since: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    };
    void this.run();
    return this.status;
  }

  private async run(): Promise<void> {
    try {
      const earliest = await this.ordersRepo
        .createQueryBuilder('order')
        .select('MIN(order.createdAt)', 'earliest')
        .getRawOne<{ earliest: Date | null }>();

      if (!earliest?.earliest) {
        this.status = {
          ...this.status,
          running: false,
          finishedAt: new Date().toISOString(),
        };
        this.logger.log('No orders found — nothing to backfill.');
        return;
      }

      const since = new Date(earliest.earliest);
      this.status.since = since.toISOString();

      // Sequential, not Promise.all — avoids doubling concurrent DB load on
      // top of the already-sequential per-outlet rollups (see rollupAllOutlets).
      await this.periodInsightsService.backfillHistory(since);
      await this.periodInsightsNpService.backfillHistory(since);

      this.status = {
        ...this.status,
        running: false,
        finishedAt: new Date().toISOString(),
      };
      this.logger.log(
        `Period insights history backfill complete (since ${since.toISOString().slice(0, 10)}).`,
      );
    } catch (err) {
      this.status = {
        ...this.status,
        running: false,
        finishedAt: new Date().toISOString(),
        error: (err as Error).message,
      };
      this.logger.error(
        `Period insights history backfill failed: ${(err as Error).message}`,
      );
    }
  }
}

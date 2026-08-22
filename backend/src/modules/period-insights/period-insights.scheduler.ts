import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PeriodInsightsNpService } from './period-insights-np.service';
import { PeriodInsightsService } from './period-insights.service';

const DAY = 24 * 60 * 60_000;

/**
 * Nightly rollup sweep for period_insights (AD) and period_insights_np
 * (BS). Runs all three period types every night rather than gating
 * weekly/monthly on the calendar boundary — rollupWeekly/rollupMonthly
 * upsert on the *last completed* window, so re-running them on
 * off-boundary nights is a cheap no-op and this stays correct even if a
 * nightly run is missed (e.g. a redeploy at midnight).
 */
@Injectable()
export class PeriodInsightsScheduler implements OnModuleInit {
  private readonly logger = new Logger(PeriodInsightsScheduler.name);

  constructor(
    private readonly periodInsightsService: PeriodInsightsService,
    private readonly periodInsightsNpService: PeriodInsightsNpService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await Promise.all([
        this.periodInsightsService.rollupAll(),
        this.periodInsightsNpService.rollupAll(),
      ]);
    } catch (err) {
      this.logger.error(
        `Boot-time period insights rollup failed: ${(err as Error).message}`,
      );
    }
  }

  @Interval(DAY)
  async runNightlyRollup(): Promise<void> {
    try {
      await Promise.all([
        this.periodInsightsService.rollupAll(),
        this.periodInsightsNpService.rollupAll(),
      ]);
    } catch (err) {
      this.logger.error(
        `Nightly period insights rollup failed: ${(err as Error).message}`,
      );
    }
  }
}

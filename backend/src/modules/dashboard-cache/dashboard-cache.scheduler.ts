import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { registerDashboardCacheRebuilder } from './dashboard-cache-bridge';
import { DashboardCacheService } from './dashboard-cache.service';

const DAY = 24 * 60 * 60_000;

/**
 * Registers the in-process debounce bridge's rebuild callback and the
 * nightly full-cache reconciliation sweep — replaces the old BullMQ-backed
 * `dashboard-cache-jobs` queue (nightly `upsertJobScheduler` + the
 * event-driven invalidation jobs the bridge used to enqueue). This is what
 * keeps the cached default range's rolling 30-day window correct on
 * outlets with no writes overnight — event-driven invalidation alone can't
 * catch a window boundary silently moving forward with the calendar.
 */
@Injectable()
export class DashboardCacheScheduler implements OnModuleInit {
  private readonly logger = new Logger(DashboardCacheScheduler.name);

  constructor(private readonly cacheService: DashboardCacheService) {}

  onModuleInit(): void {
    registerDashboardCacheRebuilder((outletId, sections) =>
      this.cacheService.rebuildSections(outletId, sections),
    );
    // Warms a newly-added outlet (or a fresh deploy of these cache tables)
    // right after boot rather than leaving it uncached until the next write
    // or the next nightly sweep. In the background, not awaited: an awaited
    // onModuleInit holds the server off listening until every outlet's
    // dashboard is recomputed, which made every cold start that much slower.
    // A dashboard request that arrives first just computes its own sections
    // on the cache miss (DashboardCacheService).
    void this.cacheService.rebuildAll().catch((err: Error) => {
      this.logger.error(`Boot-time dashboard cache warm failed: ${err.message}`);
    });
  }

  @Interval(DAY)
  async runNightlyRebuild(): Promise<void> {
    try {
      await this.cacheService.rebuildAll();
    } catch (err) {
      this.logger.error(`Nightly dashboard cache rebuild failed: ${(err as Error).message}`);
    }
  }
}

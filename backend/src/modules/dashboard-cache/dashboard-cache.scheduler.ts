import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { registerDashboardCacheQueue } from './dashboard-cache-bridge';

const HOUR = 60 * 60_000;

/**
 * Registers the nightly full-cache reconciliation job (see
 * BusinessOperationsScheduler for the base pattern). This is what keeps the
 * cached default range's rolling 30-day window correct on outlets with no
 * writes overnight — event-driven invalidation alone can't catch a window
 * boundary silently moving forward with the calendar.
 */
@Injectable()
export class DashboardCacheScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('dashboard-cache-jobs') private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    registerDashboardCacheQueue(this.queue);
    await this.queue.upsertJobScheduler(
      'dashboard-cache-nightly-rebuild',
      { every: 24 * HOUR },
      { name: 'rebuild-all' },
    );
    // A newly-added outlet (or a first deploy of these cache tables) has no
    // row yet, so its first real request falls through to a full live
    // recompute instead of the single indexed SELECT the cache exists for.
    // Warm every outlet once on boot so that gap only ever exists between
    // an outlet being created and the next app restart, not indefinitely.
    await this.queue.add(
      'rebuild-all',
      {},
      { jobId: 'dashboard-cache-boot-warm', removeOnComplete: true, removeOnFail: true },
    );
  }
}

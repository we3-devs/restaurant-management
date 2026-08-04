import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

const logger = new Logger('DashboardCacheBridge');

export type DashboardCacheSection = 'stats' | 'charts' | 'breakdown' | 'inventory';

/**
 * A module-level bridge between the TypeORM subscriber (instantiated by
 * TypeORM outside Nest's DI container — same constraint documented on
 * RealtimeChangeSubscriber/realtime-bus.ts) and the BullMQ queue owned by
 * DashboardCacheModule (a real Nest provider). The module registers its
 * queue here on init; the subscriber enqueues invalidation jobs without
 * needing any injected dependency.
 */
let invalidationQueue: Queue | null = null;

export function registerDashboardCacheQueue(queue: Queue): void {
  invalidationQueue = queue;
}

/**
 * Fire-and-forget: queues a recompute of the given cache sections for one
 * outlet. Deliberately not awaited by callers — this must never add latency
 * to the write path that triggered it (e.g. placing an order).
 */
export function enqueueDashboardInvalidation(
  outletId: number | null,
  sections: DashboardCacheSection[],
): void {
  if (!invalidationQueue) {
    logger.warn(
      `Dashboard cache queue not yet registered — dropped invalidation for outlet ${outletId}`,
    );
    return;
  }
  // Same jobId + a short delay coalesces bursts (e.g. many order_items
  // inserted for one order): BullMQ ignores an .add() for a jobId that's
  // still waiting/delayed, so rapid-fire writes collapse into one job.
  const jobId = `invalidate-${outletId ?? 'all'}-${sections.slice().sort().join(',')}`;
  invalidationQueue
    .add(
      'invalidate',
      { outletId, sections },
      { jobId, delay: 1_500 },
    )
    .catch((err: Error) =>
      logger.error(`Failed to enqueue dashboard cache invalidation: ${err.message}`),
    );
}

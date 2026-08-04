import { Logger } from '@nestjs/common';

const logger = new Logger('DashboardCacheBridge');

export type DashboardCacheSection = 'stats' | 'charts' | 'breakdown' | 'inventory';

const DEBOUNCE_MS = 1_500;

/**
 * A module-level bridge between the TypeORM subscriber (instantiated by
 * TypeORM outside Nest's DI container — same constraint documented on
 * RealtimeChangeSubscriber/realtime-bus.ts) and DashboardCacheService (a
 * real Nest provider). The module registers its rebuild callback here on
 * init; the subscriber enqueues invalidations without needing any injected
 * dependency.
 *
 * Replaces the old BullMQ-backed queue (delay + jobId-coalescing) with an
 * in-process debounce map keyed identically to the old jobId — same
 * coalesce-bursts behavior (e.g. many order_items inserted for one order
 * collapse into one rebuild), just an in-memory timer instead of a delayed
 * job. Not durable across a restart, which is fine here: a rebuild that's
 * lost mid-debounce by a restart is simply picked up by the next write to
 * the same outlet/section, or by the nightly full reconciliation.
 */
let rebuildCallback:
  | ((outletId: number | null, sections: DashboardCacheSection[]) => Promise<void>)
  | null = null;

const pendingTimers = new Map<string, NodeJS.Timeout>();

export function registerDashboardCacheRebuilder(
  callback: (
    outletId: number | null,
    sections: DashboardCacheSection[],
  ) => Promise<void>,
): void {
  rebuildCallback = callback;
}

/**
 * Debounced: queues a recompute of the given cache sections for one outlet.
 * Deliberately not awaited by callers — this must never add latency to the
 * write path that triggered it (e.g. placing an order).
 */
export function enqueueDashboardInvalidation(
  outletId: number | null,
  sections: DashboardCacheSection[],
): void {
  if (!rebuildCallback) {
    logger.warn(
      `Dashboard cache rebuilder not yet registered — dropped invalidation for outlet ${outletId}`,
    );
    return;
  }
  const key = `invalidate-${outletId ?? 'all'}-${sections.slice().sort().join(',')}`;
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(key);
    rebuildCallback!(outletId, sections).catch((err: Error) =>
      logger.error(`Dashboard cache rebuild failed for ${key}: ${err.message}`),
    );
  }, DEBOUNCE_MS);
  timer.unref();
  pendingTimers.set(key, timer);
}

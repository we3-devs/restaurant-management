import { OrderStatus } from './entities/order.entity';

/**
 * The buckets of a table_session_food_status_counts row. Declared
 * structurally so callers can pass entity rows, DTOs or raw query results
 * without converting first.
 */
export interface FoodStatusCountBuckets {
  reservedCount: number;
  orderedCount: number;
  preparingCount: number;
  readyCount: number;
  servedCount: number;
  cancelledCount: number;
}

/** A counts row with its food/variant names resolved — what the status-counts reads return. */
export interface NamedFoodStatusCount extends FoodStatusCountBuckets {
  orderId: number;
  foodId: number;
  foodName: string;
  foodVariantId: number | null;
  foodVariantName: string | null;
  tableSessionId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FoodStatusCountTotals = FoodStatusCountBuckets & {
  /** Everything that has been sent to the kitchen and not cancelled. */
  activeCount: number;
};

export function sumCounts(
  rows: readonly FoodStatusCountBuckets[],
): FoodStatusCountTotals {
  const totals = rows.reduce<FoodStatusCountBuckets>(
    (acc, row) => ({
      reservedCount: acc.reservedCount + Number(row.reservedCount),
      orderedCount: acc.orderedCount + Number(row.orderedCount),
      preparingCount: acc.preparingCount + Number(row.preparingCount),
      readyCount: acc.readyCount + Number(row.readyCount),
      servedCount: acc.servedCount + Number(row.servedCount),
      cancelledCount: acc.cancelledCount + Number(row.cancelledCount),
    }),
    {
      reservedCount: 0,
      orderedCount: 0,
      preparingCount: 0,
      readyCount: 0,
      servedCount: 0,
      cancelledCount: 0,
    },
  );

  return {
    ...totals,
    activeCount:
      totals.orderedCount +
      totals.preparingCount +
      totals.readyCount +
      totals.servedCount,
  };
}

/**
 * The happy-path stage an order's counts have collectively reached, or null
 * when there's nothing to derive yet — nothing has left the cart, or every
 * line was cancelled. This is the only function that turns kitchen progress
 * into an order stage; the counts table is the single aggregate it reads.
 *
 * Cancelled units are ignored rather than holding an order back — an order
 * whose remaining lines are all served is served, regardless of what was
 * voided along the way. Cart-stage (reserved) units, by contrast, do hold
 * the order back from a *complete* stage: an order with a held item still
 * waiting to be fired is 'partially_served', not 'served'. They just can't
 * push it forward on their own, which is why activeCount gates the top.
 */
export function deriveOrderStageFromCounts(
  rows: readonly FoodStatusCountBuckets[],
): OrderStatus | null {
  const {
    reservedCount,
    orderedCount,
    preparingCount,
    readyCount,
    servedCount,
    activeCount,
  } = sumCounts(rows);
  if (activeCount === 0) return null;

  const unserved =
    reservedCount + orderedCount + preparingCount + readyCount;
  if (servedCount > 0) return unserved === 0 ? 'served' : 'partially_served';

  const unready = reservedCount + orderedCount + preparingCount;
  if (readyCount > 0) return unready === 0 ? 'ready' : 'partially_ready';

  if (preparingCount > 0) return 'preparing';
  if (orderedCount > 0) return 'accepted';
  return null;
}

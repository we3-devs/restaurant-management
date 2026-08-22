import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type PeriodType = 'daily' | 'weekly' | 'monthly';

export interface PeriodInsightPayload {
  salesOverview: {
    orderCount: number;
    grandTotal: number;
    avgOrderValue: number;
  };
  ordersOverview: { status: string; count: number }[];
  paymentBreakdown: { method: string; amount: number }[];
  bestSellingFoods: {
    foodId: number;
    foodName: string;
    quantitySold: number;
    revenue: number;
  }[];
  wastageSummary: { reason: string; quantity: number; totalCost: number }[];
  kitchenOverview: {
    openTickets: number;
    inProgressTickets: number;
    avgPrepMinutes: number | null;
  };
  revenueTrend: { date: string; orderCount: number; grandTotal: number }[];
}

/**
 * One row per (outlet, period type, period start) — a persisted rollup of
 * raw order/payment/kitchen/wastage activity into actionable numbers for a
 * completed day/week/month. Sentinel outlet_id = 0 is the unfiltered "all
 * outlets" row, matching the dashboard-cache convention. Unlike
 * dashboard_*_cache (which caches whatever rolling range the dashboard UI
 * happens to request), these rows are fixed-period historical facts that
 * are never recomputed once the period has closed, so they stay cheap to
 * trend over months of history.
 */
@Entity({ name: 'period_insights' })
@Index(
  'idx_period_insights_lookup',
  ['outletId', 'periodType', 'periodStart'],
  {
    unique: true,
  },
)
export class PeriodInsight {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @Column({ name: 'period_type', type: 'varchar', length: 10 })
  periodType: PeriodType;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  /** Human-readable label, e.g. "Aug 21, 2026", "Aug 17 – 23, 2026", "August 2026". */
  @Column({ name: 'period_label', type: 'varchar', length: 60 })
  periodLabel: string;

  @Column({ type: 'jsonb' })
  payload: PeriodInsightPayload;

  @CreateDateColumn({ name: 'computed_at', type: 'timestamp' })
  computedAt: Date;
}

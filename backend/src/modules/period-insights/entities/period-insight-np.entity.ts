import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import type { PeriodInsightPayload, PeriodType } from './period-insight.entity';

export type { PeriodType, PeriodInsightPayload };

/**
 * BS (Bikram Sambat) counterpart of `PeriodInsight` — computed on real
 * Nepali calendar boundaries (Baisakh-Chaitra months, Sun-Sat weeks)
 * rather than AD ones. Kept as a separate table because BS month/week
 * boundaries don't align with AD ones — an AD-bounded row can't honestly
 * carry a BS label (e.g. AD Jan 1-30 actually spans two different BS
 * months), so each calendar gets its own rollup computed on its own
 * boundaries. See `modules/period-insights/period-insights-np.util.ts`.
 */
@Entity({ name: 'period_insights_np' })
@Index(
  'idx_period_insights_np_lookup',
  ['outletId', 'periodType', 'periodStartBs'],
  { unique: true },
)
export class PeriodInsightNp {
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

  /** BS calendar date, 'YYYY-MM-DD'. */
  @Column({ name: 'period_start_bs', type: 'varchar', length: 10 })
  periodStartBs: string;

  /** BS calendar date, 'YYYY-MM-DD', exclusive. */
  @Column({ name: 'period_end_bs', type: 'varchar', length: 10 })
  periodEndBs: string;

  /** AD-equivalent instant of periodStartBs — used to query the AD-timestamped orders/payments tables. */
  @Column({ name: 'period_start_ad', type: 'date' })
  periodStartAd: string;

  /** AD-equivalent instant of periodEndBs, exclusive. */
  @Column({ name: 'period_end_ad', type: 'date' })
  periodEndAd: string;

  /** Human-readable BS label, e.g. "Bhadra 5, 2083", "Ashad 30 – Shrawan 6, 2083", "Bhadra 2083". */
  @Column({ name: 'period_label', type: 'varchar', length: 60 })
  periodLabel: string;

  @Column({ type: 'jsonb' })
  payload: PeriodInsightPayload;

  @CreateDateColumn({ name: 'computed_at', type: 'timestamp' })
  computedAt: Date;
}

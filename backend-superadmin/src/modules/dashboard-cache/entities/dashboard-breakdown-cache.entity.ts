import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import type { DashboardBreakdown } from '../../dashboard/dashboard.service';

/** One row per outlet, sentinel outlet_id = 0 for the unfiltered "all outlets" view. */
@Entity({ name: 'dashboard_breakdown_cache' })
export class DashboardBreakdownCache {
  @PrimaryColumn({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @Column({ name: 'range_from', type: 'timestamp' })
  rangeFrom: Date;

  @Column({ name: 'range_to', type: 'timestamp' })
  rangeTo: Date;

  @Column({ type: 'jsonb' })
  payload: DashboardBreakdown;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

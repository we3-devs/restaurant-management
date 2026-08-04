import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import type { DashboardInventoryActivity } from '../../dashboard/dashboard.service';

/**
 * One row per outlet, sentinel outlet_id = 0 for the unfiltered "all
 * outlets" view. No range columns: the underlying queries (low-stock levels,
 * recent activity feed) aren't date-filtered, so this row is always valid
 * regardless of the requested date range.
 */
@Entity({ name: 'dashboard_inventory_cache' })
export class DashboardInventoryCache {
  @PrimaryColumn({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @Column({ type: 'jsonb' })
  payload: DashboardInventoryActivity;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

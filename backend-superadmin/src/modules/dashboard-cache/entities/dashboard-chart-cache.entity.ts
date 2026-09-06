import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import type { DashboardCharts } from '../../dashboard/dashboard.service';

/** One row per outlet, sentinel outlet_id = 0 for the unfiltered "all outlets" view. */
@Entity({ name: 'dashboard_chart_cache' })
export class DashboardChartCache {
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
  payload: DashboardCharts;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

/**
 * One canonical daily aggregate row per outlet or tenant. Tenant rows have a
 * null outlet_id; outlet rows have a null tenant_id.
 */
@Entity({ name: 'analytics_daily_snapshots' })
@Index('idx_analytics_daily_snapshots_lookup', ['outletId', 'businessDate'], { unique: true })
@Index('idx_analytics_daily_snapshots_tenant_lookup', ['tenantId', 'businessDate'], { unique: true })
@Index('idx_analytics_daily_snapshots_date', ['businessDate'])
export class AnalyticsDailySnapshot {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'outlet_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  outletId: number | null;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  tenantId: number | null;

  @Column({ name: 'business_date', type: 'date' })
  businessDate: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'generated_at', type: 'timestamp' })
  generatedAt: Date;
}

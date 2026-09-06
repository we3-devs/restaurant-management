import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'payment'
  | 'refund'
  | 'inventory_movement'
  | 'purchase_approval'
  | 'reservation_change'
  | 'settings_change'
  | 'role_change'
  | 'permission_change'
  | 'order_change'
  | 'kitchen_status_change'
  | 'operational_override';

/** Append-only activity trail, written asynchronously via the `audit-log-write` queue (see AuditInterceptor). */
@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'user_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  userId: number | null;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId: string | null;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: Record<string, unknown> | null;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

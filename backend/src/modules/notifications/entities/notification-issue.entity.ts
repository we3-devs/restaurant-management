import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type NotificationIssueStatus = 'unresolved' | 'resolved';

/** An operational problem created when a policy cannot produce a recipient. */
@Entity({ name: 'notification_issues' })
export class NotificationIssue {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;

  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;

  @Column({ name: 'notification_type', type: 'varchar', length: 255 })
  notificationType: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'policy_version_id', type: 'bigint', nullable: true })
  policyVersionId: number | null;

  @Column({ name: 'notification_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  notificationId: number | null;

  @Column({ type: 'varchar', length: 20, default: "'unresolved'" })
  status: NotificationIssueStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { User } from '../../users/entities/user.entity';
import type { NotificationType } from './notification.entity';

/**
 * One row per user. email/sms/push are opt-in (default false) since they
 * require working contact info and user consent. mutedTypes suppresses a
 * notification type entirely, including in-app delivery.
 */
@Entity({ name: 'notification_preferences' })
export class NotificationPreference {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', transformer: new BigIntTransformer(), unique: true })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'email_enabled', type: 'boolean', default: false })
  emailEnabled: boolean;

  @Column({ name: 'sms_enabled', type: 'boolean', default: false })
  smsEnabled: boolean;

  @Column({ name: 'push_enabled', type: 'boolean', default: false })
  pushEnabled: boolean;

  /** Notification types the user never wants delivered on any channel, including in-app. */
  @Column({ name: 'muted_types', type: 'text', array: true, default: () => "'{}'" })
  mutedTypes: NotificationType[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

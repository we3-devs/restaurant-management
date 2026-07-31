import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Order } from '../../orders/entities/order.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Doubles as the notification's "category" — grouped client-side for
 * filtering (see frontend/src/lib/validators/notifications.ts) rather than
 * carrying a second, overlapping taxonomy column.
 */
export type NotificationType =
  | 'kitchen_ready'
  | 'kitchen_delayed'
  | 'kitchen_recalled'
  | 'kitchen_cancelled'
  | 'order_sent'
  | 'order_ready'
  | 'order_cancelled'
  | 'payment_received'
  | 'reservation_created'
  | 'reservation_cancelled'
  | 'reservation_reminder'
  | 'low_stock'
  | 'out_of_stock'
  | 'stock_adjustment'
  | 'service_request'
  | 'report_generated'
  | 'user_created'
  | 'system';

export type NotificationPriority = 'normal' | 'high' | 'urgent';

/**
 * A persisted, outlet-scoped feed entry. Created by kitchen-ready transitions
 * and service requests; delivered to connected POS / waiter screens over the
 * /kds websocket (see KitchenTicketsGateway#notifyNotificationCreated) and
 * shown in the global header bell.
 */
@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;

  @Column({ type: 'varchar', length: 255 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'table_name', type: 'varchar', length: 255, nullable: true })
  tableName: string | null;

  @Column({
    name: 'order_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  /** Free-form JSON payload (e.g. item names), kept as text to match the schema's plain columns. */
  @Column({ type: 'text', nullable: true })
  data: string | null;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority: NotificationPriority;

  @Column({ name: 'archived_at', type: 'timestamp', nullable: true })
  archivedAt: Date | null;

  @Column({
    name: 'actor_user_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  actorUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

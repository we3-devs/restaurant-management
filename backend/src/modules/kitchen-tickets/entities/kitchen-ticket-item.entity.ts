import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { KitchenTicket } from './kitchen-ticket.entity';

export type KitchenTicketItemStatus =
  'sent_to_kitchen' | 'preparing' | 'ready' | 'served' | 'cancelled';

@Entity({ name: 'kitchen_ticket_items' })
export class KitchenTicketItem {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'ticket_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ticketId: number;

  @ManyToOne(() => KitchenTicket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: KitchenTicket;

  @Column({
    name: 'order_item_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  orderItemId: number;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ type: 'varchar', length: 255, default: 'sent_to_kitchen' })
  status: KitchenTicketItemStatus;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'ready_at', type: 'timestamp', nullable: true })
  readyAt: Date | null;

  @Column({ name: 'served_at', type: 'timestamp', nullable: true })
  servedAt: Date | null;

  @Column({ name: 'recalled_at', type: 'timestamp', nullable: true })
  recalledAt: Date | null;

  @Column({ name: 'recall_count', type: 'int', default: 0 })
  recallCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

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
import { Order } from './order.entity';
import type { OrderStatus } from './order.entity';

@Entity({ name: 'order_status_histories' })
export class OrderStatusHistory {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'order_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    name: 'changed_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  changedBy: number | null;

  @Column({ name: 'from_status', type: 'varchar', length: 255, nullable: true })
  fromStatus: OrderStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 255 })
  toStatus: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

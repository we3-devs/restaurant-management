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
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Addon } from '../../addons/entities/addon.entity';
import { OrderItem } from './order-item.entity';

@Entity({ name: 'order_item_addons' })
export class OrderItemAddon {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'order_item_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  orderItemId: number;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({
    name: 'addon_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  addonId: number;

  @ManyToOne(() => Addon, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'addon_id' })
  addon: Addon;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 1,
    transformer: new NumericTransformer(),
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  unitPrice: number;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  totalAmount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

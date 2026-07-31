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
import { Food } from '../../foods/entities/food.entity';
import { FoodVariant } from '../../food-variants/entities/food-variant.entity';
import { OutletDepartment } from '../../outlet-departments/entities/outlet-department.entity';
import { Order } from './order.entity';

export type OrderItemStatus =
  | 'stock_reserved'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

@Entity({ name: 'order_items' })
export class OrderItem {
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
    name: 'food_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  foodId: number;

  @ManyToOne(() => Food, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'food_id' })
  food: Food;

  @Column({
    name: 'food_variant_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  foodVariantId: number | null;

  @ManyToOne(() => FoodVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'food_variant_id' })
  foodVariant: FoodVariant | null;

  @Column({
    name: 'preparation_department_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  preparationDepartmentId: number | null;

  @ManyToOne(() => OutletDepartment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'preparation_department_id' })
  preparationDepartment: OutletDepartment | null;

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
    name: 'tax_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  taxAmount: number;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  totalAmount: number;

  @Column({ type: 'varchar', length: 255, default: 'stock_reserved' })
  status: OrderItemStatus;

  /**
   * Fire/Hold: a held item stays in the cart (status 'stock_reserved') when
   * the rest of the order is sent to the kitchen, and is routed later via
   * "Fire Held Items". Only meaningful while status is 'stock_reserved'.
   */
  @Column({ name: 'is_held', type: 'boolean', default: false })
  isHeld: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

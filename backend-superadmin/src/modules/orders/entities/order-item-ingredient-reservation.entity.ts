import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

export type OrderItemIngredientReservationStatus =
  'reserved' | 'consumed' | 'released';

@Entity({ name: 'order_item_ingredient_reservations' })
export class OrderItemIngredientReservation {
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

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  warehouseId: number;

  @Column({
    name: 'ingredient_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientId: number;

  @Column({
    name: 'reserved_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  reservedQuantity: number;

  @Column({
    name: 'consumed_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  consumedQuantity: number;

  @Column({
    name: 'wastage_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  wastageQuantity: number;

  @Column({ type: 'varchar', length: 20, default: 'reserved' })
  status: OrderItemIngredientReservationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

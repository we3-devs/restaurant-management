import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ name: 'warehouse_ingredient_stocks' })
export class WarehouseIngredientStock {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

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
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  quantity: number;

  @Column({
    name: 'average_cost',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
    transformer: new NumericTransformer(),
  })
  averageCost: number;

  @Column({
    name: 'stock_value',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  stockValue: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

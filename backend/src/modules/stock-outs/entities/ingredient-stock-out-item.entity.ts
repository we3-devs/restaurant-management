import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ name: 'ingredient_stock_out_items' })
export class IngredientStockOutItem {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'ingredient_stock_out_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientStockOutId: number;

  @Column({
    name: 'ingredient_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientId: number;

  @Column({
    name: 'ingredient_batch_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  ingredientBatchId: number | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    transformer: new NumericTransformer(),
  })
  quantity: number;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
    transformer: new NumericTransformer(),
  })
  unitCost: number;

  @Column({
    name: 'total_cost',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  totalCost: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

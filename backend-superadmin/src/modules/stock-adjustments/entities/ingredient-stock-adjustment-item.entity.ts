import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ name: 'ingredient_stock_adjustment_items' })
export class IngredientStockAdjustmentItem {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'ingredient_stock_adjustment_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientStockAdjustmentId: number;

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
    name: 'system_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  systemQuantity: number;

  @Column({
    name: 'actual_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  actualQuantity: number;

  @Column({
    name: 'difference_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  differenceQuantity: number;

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
    name: 'difference_value',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  differenceValue: number;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

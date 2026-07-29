import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ name: 'ingredient_stock_transfer_items' })
export class IngredientStockTransferItem {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'ingredient_stock_transfer_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientStockTransferId: number;

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
    name: 'requested_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  requestedQuantity: number;

  @Column({
    name: 'dispatched_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  dispatchedQuantity: number;

  @Column({
    name: 'received_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  receivedQuantity: number;

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

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

export type InventoryTransactionType =
  | 'opening_stock'
  | 'purchase_receive'
  | 'purchase_return'
  | 'transfer_in'
  | 'transfer_out'
  | 'sale_consume'
  | 'production_consume'
  | 'wastage'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'stock_count_gain'
  | 'stock_count_loss';

@Entity({ name: 'ingredient_inventory_transactions' })
export class IngredientInventoryTransaction {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'ingredient_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientId: number;

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  warehouseId: number;

  @Column({
    name: 'ingredient_batch_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  ingredientBatchId: number | null;

  @Column({ name: 'transaction_type', type: 'varchar', length: 30 })
  transactionType: InventoryTransactionType;

  @Column({
    name: 'quantity_in',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  quantityIn: number;

  @Column({
    name: 'quantity_out',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  quantityOut: number;

  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  balanceAfter: number;

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

  // Laravel polymorphic `reference` morph — plain columns, no real FK.
  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  referenceType: string | null;

  @Column({
    name: 'reference_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  referenceId: number | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({
    name: 'created_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

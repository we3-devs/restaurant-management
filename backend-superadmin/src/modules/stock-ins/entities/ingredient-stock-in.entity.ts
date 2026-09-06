import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type StockInSource =
  'purchase' | 'return' | 'correction' | 'donation' | 'other' | 'transfer';

export type StockInStatus = 'draft' | 'approved' | 'cancelled';

@Entity({ name: 'ingredient_stock_ins' })
export class IngredientStockIn {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'stock_in_no', type: 'varchar', length: 255, unique: true })
  stockInNo: string;

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  warehouseId: number;

  @Column({ name: 'stock_in_date', type: 'date' })
  stockInDate: string;

  @Column({ type: 'varchar', length: 20, default: 'other' })
  source: StockInSource;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: StockInStatus;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({
    name: 'created_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  createdBy: number | null;

  @Column({
    name: 'approved_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  approvedBy: number | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

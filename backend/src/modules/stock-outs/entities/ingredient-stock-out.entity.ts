import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type StockOutPurpose =
  | 'production_use'
  | 'kitchen_use'
  | 'sample'
  | 'distribution'
  | 'other'
  | 'transfer';

export type StockOutStatus = 'draft' | 'approved' | 'cancelled';

@Entity({ name: 'ingredient_stock_outs' })
export class IngredientStockOut {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'stock_out_no', type: 'varchar', length: 255, unique: true })
  stockOutNo: string;

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  warehouseId: number;

  @Column({ name: 'stock_out_date', type: 'date' })
  stockOutDate: string;

  @Column({ type: 'varchar', length: 20, default: 'other' })
  purpose: StockOutPurpose;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: StockOutStatus;

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

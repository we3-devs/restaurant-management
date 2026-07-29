import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

// Only draft/completed/adjusted/cancelled are used this phase — the DB's
// 'counting' intermediate state is not modeled as a distinct step.
export type StockCountStatus = 'draft' | 'completed' | 'adjusted' | 'cancelled';

@Entity({ name: 'ingredient_stock_counts' })
export class IngredientStockCount {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'count_no', type: 'varchar', length: 255, unique: true })
  countNo: string;

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  warehouseId: number;

  @Column({ name: 'count_date', type: 'date' })
  countDate: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: StockCountStatus;

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
    name: 'completed_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  completedBy: number | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type WastageReason =
  | 'expired'
  | 'damaged'
  | 'spoiled'
  | 'over_preparation'
  | 'staff_error'
  | 'other';

export type WastageStatus = 'draft' | 'approved' | 'cancelled';

@Entity({ name: 'ingredient_wastages' })
export class IngredientWastage {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'wastage_no', type: 'varchar', length: 255, unique: true })
  wastageNo: string;

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  warehouseId: number;

  @Column({ name: 'wastage_date', type: 'date' })
  wastageDate: string;

  @Column({ type: 'varchar', length: 20, default: 'other' })
  reason: WastageReason;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: WastageStatus;

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

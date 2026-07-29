import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

// Only draft/approved/cancelled are used this phase — the DB's finer-grained
// requested/approved/dispatched/partially_received/received states are not
// modeled; approve() posts both transfer legs atomically.
export type StockTransferStatus = 'draft' | 'approved' | 'cancelled';

@Entity({ name: 'ingredient_stock_transfers' })
export class IngredientStockTransfer {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'transfer_no', type: 'varchar', length: 255, unique: true })
  transferNo: string;

  @Column({
    name: 'from_warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  fromWarehouseId: number;

  @Column({
    name: 'to_warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  toWarehouseId: number;

  @Column({ name: 'transfer_date', type: 'date' })
  transferDate: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: StockTransferStatus;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({
    name: 'requested_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  requestedBy: number | null;

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

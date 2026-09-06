import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

export type GRNStatus = 'draft' | 'received' | 'cancelled';

@Entity({ name: 'goods_receivings' })
export class GoodsReceiving {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'grn_no', type: 'varchar', length: 255, unique: true })
  grnNo: string;
  @Column({ name: 'purchase_order_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  purchaseOrderId: number | null;
  @ManyToOne(() => PurchaseOrder, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;
  @Column({ name: 'supplier_id', type: 'bigint', transformer: new BigIntTransformer() })
  supplierId: number;
  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;
  @Column({ name: 'warehouse_id', type: 'bigint', transformer: new BigIntTransformer() })
  warehouseId: number;
  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;
  @Column({ name: 'received_date', type: 'date' })
  receivedDate: string;
  @Column({ type: 'text', nullable: true })
  notes: string | null;
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: GRNStatus;
  @Column({ name: 'created_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  createdBy: number | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

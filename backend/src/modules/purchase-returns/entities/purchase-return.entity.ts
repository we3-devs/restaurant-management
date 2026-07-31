import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { GoodsReceiving } from '../../goods-receiving/entities/goods-receiving.entity';

export type PurchaseReturnStatus = 'draft' | 'processed' | 'cancelled';
export type RefundType = 'refund' | 'replacement' | 'both';

@Entity({ name: 'purchase_returns' })
export class PurchaseReturn {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'return_no', type: 'varchar', length: 255, unique: true })
  returnNo: string;
  @Column({ name: 'purchase_order_id', type: 'bigint', transformer: new BigIntTransformer() })
  purchaseOrderId: number;
  @ManyToOne(() => PurchaseOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;
  @Column({ name: 'goods_receiving_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  goodsReceivingId: number | null;
  @ManyToOne(() => GoodsReceiving, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'goods_receiving_id' })
  goodsReceiving: GoodsReceiving | null;
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
  @Column({ name: 'return_date', type: 'date' })
  returnDate: string;
  @Column({ type: 'text', nullable: true })
  reason: string | null;
  @Column({ name: 'refund_type', type: 'varchar', length: 20, default: 'refund' })
  refundType: RefundType;
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: PurchaseReturnStatus;
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

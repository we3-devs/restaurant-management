import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'partially_received'
  | 'received'
  | 'completed'
  | 'cancelled';

export const VALID_PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'cancelled'],
  approved: ['partially_received', 'received', 'cancelled'],
  partially_received: ['received', 'completed', 'cancelled'],
  received: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

@Entity({ name: 'purchase_orders' })
export class PurchaseOrder {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;

  @Column({ name: 'po_no', type: 'varchar', length: 255, unique: true })
  poNo: string;

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

  @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
  expectedDeliveryDate: string | null;

  @Column({ type: 'varchar', length: 10, default: 'NPR' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: PurchaseOrderStatus;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  subtotal: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  discountAmount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  taxAmount: number;

  @Column({ name: 'grand_total', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  grandTotal: number;

  @Column({ name: 'created_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  createdBy: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @Column({ name: 'approved_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  approvedBy: number | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

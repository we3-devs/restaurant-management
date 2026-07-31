import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';

export type PaymentMethod = 'cash' | 'bank' | 'digital';
export type PaymentStatus = 'completed' | 'pending' | 'cancelled';

@Entity({ name: 'supplier_payments' })
export class SupplierPayment {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'payment_no', type: 'varchar', length: 255, unique: true })
  paymentNo: string;
  @Column({ name: 'supplier_id', type: 'bigint', transformer: new BigIntTransformer() })
  supplierId: number;
  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
  @Column({ name: 'purchase_order_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  purchaseOrderId: number | null;
  @ManyToOne(() => PurchaseOrder, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder | null;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;
  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: string;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  amount: number;
  @Column({ name: 'payment_method', type: 'varchar', length: 50 })
  paymentMethod: PaymentMethod;
  @Column({ name: 'reference_no', type: 'varchar', length: 255, nullable: true })
  referenceNo: string | null;
  @Column({ type: 'text', nullable: true })
  notes: string | null;
  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status: PaymentStatus;
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

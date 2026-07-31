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
import { Customer } from '../../customers/entities/customer.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { Reservation } from '../../reservations/entities/reservation.entity';
import { TableSession } from '../../table-sessions/entities/table-session.entity';
import { User } from '../../users/entities/user.entity';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderSourceChannel =
  'walk_in' | 'phone' | 'online' | 'staff' | 'other';
export type OrderChannel = 'pos' | 'qr' | 'waiter' | 'online';
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'partially_ready'
  | 'ready'
  | 'partially_served'
  | 'served'
  | 'completed'
  | 'cancelled';
export type OrderPaymentStatus =
  'unpaid' | 'partial' | 'paid' | 'refunded' | 'cancelled';
export type OrderApprovalStatus = 'pending' | 'accepted' | 'rejected';
export type OrderDiscountType = 'flat' | 'percentage';

const money = () => ({
  type: 'numeric' as const,
  precision: 18,
  scale: 4,
  default: 0,
  transformer: new NumericTransformer(),
});

@Entity({ name: 'orders' })
export class Order {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;

  @Column({
    name: 'reservation_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  reservationId: number | null;

  @ManyToOne(() => Reservation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reservation_id' })
  reservation: Reservation | null;

  @Column({
    name: 'customer_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  customerId: number | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({
    name: 'table_session_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  tableSessionId: number | null;

  @ManyToOne(() => TableSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_session_id' })
  tableSession: TableSession | null;

  @Column({
    name: 'created_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  createdBy: number | null;

  @Column({
    name: 'updated_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  updatedBy: number | null;

  @Column({
    name: 'cancelled_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  cancelledBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @Column({ name: 'order_number', type: 'varchar', length: 255, unique: true })
  orderNumber: string;

  @Column({
    name: 'order_type',
    type: 'varchar',
    length: 255,
    default: 'dine_in',
  })
  orderType: OrderType;

  @Column({ type: 'varchar', length: 255, default: 'staff' })
  source: OrderSourceChannel;

  @Column({
    name: 'order_source',
    type: 'varchar',
    length: 255,
    default: 'pos',
  })
  orderSource: OrderChannel;

  @Column({ type: 'varchar', length: 255, default: 'pending' })
  status: OrderStatus;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    length: 255,
    default: 'unpaid',
  })
  paymentStatus: OrderPaymentStatus;

  @Column({
    name: 'approval_status',
    type: 'varchar',
    length: 255,
    default: 'accepted',
  })
  approvalStatus: OrderApprovalStatus;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'subtotal', ...money() })
  subtotal: number;

  @Column({
    name: 'discount_type',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  discountType: OrderDiscountType | null;

  @Column({ name: 'discount_value', ...money() })
  discountValue: number;

  @Column({ name: 'discount_amount', ...money() })
  discountAmount: number;

  @Column({ name: 'service_charge_amount', ...money() })
  serviceChargeAmount: number;

  @Column({ name: 'tax_amount', ...money() })
  taxAmount: number;

  @Column({ name: 'grand_total', ...money() })
  grandTotal: number;

  @Column({ name: 'paid_amount', ...money() })
  paidAmount: number;

  @Column({ name: 'due_amount', ...money() })
  dueAmount: number;

  @Column({ name: 'refunded_amount', ...money() })
  refundedAmount: number;

  @Column({ name: 'loyalty_points_earned', type: 'int', default: 0 })
  loyaltyPointsEarned: number;

  @Column({ name: 'loyalty_points_redeemed', type: 'int', default: 0 })
  loyaltyPointsRedeemed: number;

  @Column({
    name: 'loyalty_discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  loyaltyDiscountAmount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

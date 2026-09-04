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
import { Order } from '../../orders/entities/order.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { User } from '../../users/entities/user.entity';

export type OrderPaymentType = 'payment' | 'refund';
export type OrderPaymentMethod =
  'cash' | 'card' | 'online' | 'credit' | 'other';
export type OrderPaymentStatus =
  'pending' | 'completed' | 'failed' | 'cancelled';

@Entity({ name: 'order_payments' })
export class OrderPayment {
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
    name: 'order_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  // Set only when method="credit" — the customer whose tab this payment was
  // charged to (see OrderPaymentsService.create -> CustomerCreditService).
  @Column({
    name: 'customer_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  customerId: number | null;

  @Column({
    name: 'received_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  receivedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'received_by' })
  receivedByUser: User | null;

  @Column({
    name: 'payment_number',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  paymentNumber: string;

  @Column({ type: 'varchar', length: 255, default: 'payment' })
  type: OrderPaymentType;

  @Column({ type: 'varchar', length: 255, default: 'cash' })
  method: OrderPaymentMethod;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider: string | null;

  @Column({
    name: 'transaction_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  transactionReference: string | null;

  /** Client supplied retry key. One key can only create one ledger entry per outlet. */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  idempotencyKey: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  amount: number;

  @Column({ type: 'varchar', length: 255, default: 'completed' })
  status: OrderPaymentStatus;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

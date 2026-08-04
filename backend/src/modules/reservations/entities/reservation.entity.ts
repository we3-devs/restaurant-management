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
import { User } from '../../users/entities/user.entity';

export type ReservationStatus =
  'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type ReservationSource =
  'walk_in' | 'phone' | 'online' | 'staff' | 'other';
export type ReservationDepositStatus =
  'not_required' | 'pending' | 'paid' | 'refunded' | 'forfeited';

@Entity({ name: 'reservations' })
export class Reservation {
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
    name: 'customer_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  customerId: number;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'reserved_at', type: 'timestamp' })
  reservedAt: Date;

  @Column({ name: 'guest_count', type: 'int', default: 1 })
  guestCount: number;

  @Column({ type: 'varchar', length: 255, default: 'pending' })
  status: ReservationStatus;

  @Column({ type: 'varchar', length: 255, default: 'staff' })
  source: ReservationSource;

  @Column({ name: 'special_request', type: 'text', nullable: true })
  specialRequest: string | null;

  @Column({ name: 'internal_note', type: 'text', nullable: true })
  internalNote: string | null;

  @Column({
    name: 'deposit_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  depositAmount: number;

  @Column({
    name: 'deposit_status',
    type: 'varchar',
    length: 255,
    default: 'not_required',
  })
  depositStatus: ReservationDepositStatus;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'seated_at', type: 'timestamp', nullable: true })
  seatedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'no_show_at', type: 'timestamp', nullable: true })
  noShowAt: Date | null;

  /** Stamped by ReservationReminderScheduler once the pre-arrival reminder has been sent, so its 1-minute scan never double-sends. */
  @Column({ name: 'reminder_sent_at', type: 'timestamp', nullable: true })
  reminderSentAt: Date | null;

  @Column({
    name: 'created_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  createdBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @Column({
    name: 'updated_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  updatedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

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
import { DiningTable } from '../../dining-tables/entities/dining-table.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { User } from '../../users/entities/user.entity';

export type TableSessionSource =
  'walk_in' | 'reservation' | 'qr_order' | 'staff';
export type TableSessionStatus =
  'active' | 'billing' | 'completed' | 'cancelled';

@Entity({ name: 'table_sessions' })
export class TableSession {
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
    name: 'dining_table_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  diningTableId: number;

  @ManyToOne(() => DiningTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dining_table_id' })
  diningTable: DiningTable;

  // reservationId/customerId map columns that exist in the schema but have no
  // entity yet (Reservations/Customers domains aren't built) — left nullable
  // and unset by the app this phase.
  @Column({
    name: 'reservation_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  reservationId: number | null;

  @Column({
    name: 'customer_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  customerId: number | null;

  @Column({ name: 'guest_count', type: 'int', default: 1 })
  guestCount: number;

  @Column({ type: 'varchar', length: 255, default: 'qr_order' })
  source: TableSessionSource;

  @Column({ type: 'varchar', length: 255, default: 'active' })
  status: TableSessionStatus;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'billing_started_at', type: 'timestamp', nullable: true })
  billingStartedAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({
    name: 'started_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  startedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'started_by' })
  startedByUser: User | null;

  @Column({
    name: 'ended_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  endedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ended_by' })
  endedByUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

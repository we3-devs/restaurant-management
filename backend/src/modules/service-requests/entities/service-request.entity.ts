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

export type ServiceRequestType = 'water' | 'bill' | 'assistance' | 'other';

export type ServiceRequestStatus =
  'pending' | 'in_progress' | 'resolved' | 'cancelled';

/**
 * A guest/staff "Call Waiter" request. Created from the guest QR page (via the
 * table's code) or by staff from the Floor table dialog; drained by waitstaff
 * from the Service screen.
 */
@Entity({ name: 'service_requests' })
export class ServiceRequest {
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

  @Column({ type: 'varchar', length: 255 })
  type: ServiceRequestType;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 255, default: 'pending' })
  status: ServiceRequestStatus;

  @Column({
    name: 'requested_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  requestedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by' })
  requestedByUser: User | null;

  @Column({
    name: 'resolved_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  resolvedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by' })
  resolvedByUser: User | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

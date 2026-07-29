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
import { Order } from './order.entity';

export type OrderTableAssignmentType =
  'reserved_copy' | 'added_on_arrival' | 'changed_by_staff';

@Entity({ name: 'order_tables' })
export class OrderTable {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'order_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    name: 'dining_table_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  diningTableId: number;

  @ManyToOne(() => DiningTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dining_table_id' })
  diningTable: DiningTable;

  @Column({
    name: 'assignment_type',
    type: 'varchar',
    length: 255,
    default: 'reserved_copy',
  })
  assignmentType: OrderTableAssignmentType;

  @Column({
    name: 'assigned_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  assignedBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

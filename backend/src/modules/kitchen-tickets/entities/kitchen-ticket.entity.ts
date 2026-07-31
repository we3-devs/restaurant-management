import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Order } from '../../orders/entities/order.entity';
import { OutletDepartment } from '../../outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { KitchenTicketItem } from './kitchen-ticket-item.entity';

export type KitchenTicketStatus =
  'open' | 'in_progress' | 'completed' | 'cancelled';

export type KitchenTicketPriority = 'normal' | 'high' | 'urgent';

/**
 * A kitchen's work queue for one order/department pair — created by
 * OrdersService.sendToKitchen(), one row per department represented among
 * the items being sent (null departmentId = items with no department set).
 */
@Entity({ name: 'kitchen_tickets' })
export class KitchenTicket {
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
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;

  @Column({
    name: 'department_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  departmentId: number | null;

  @ManyToOne(() => OutletDepartment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: OutletDepartment | null;

  @Column({ type: 'varchar', length: 255, default: 'open' })
  status: KitchenTicketStatus;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority: KitchenTicketPriority;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'ready_at', type: 'timestamp', nullable: true })
  readyAt: Date | null;

  @Column({ name: 'served_at', type: 'timestamp', nullable: true })
  servedAt: Date | null;

  @Column({ name: 'recalled_at', type: 'timestamp', nullable: true })
  recalledAt: Date | null;

  @Column({ name: 'recall_count', type: 'int', default: 0 })
  recallCount: number;

  @OneToMany(() => KitchenTicketItem, (item) => item.ticket)
  items: KitchenTicketItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

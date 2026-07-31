import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Employee } from '../../employees/entities/employee.entity';
import { Order } from '../../orders/entities/order.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';

@Entity({ name: 'order_assignments' })
export class OrderAssignment {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'employee_id', type: 'bigint', transformer: new BigIntTransformer() })
  employeeId: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
  @Column({ name: 'order_id', type: 'bigint', transformer: new BigIntTransformer() })
  orderId: number;
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;
  @Column({ name: 'assigned_at', type: 'timestamp', default: () => 'NOW()' })
  assignedAt: Date;
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
  @Column({ name: 'served_at', type: 'timestamp', nullable: true })
  servedAt: Date | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @Column({ name: 'created_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  createdBy: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

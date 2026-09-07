import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Employee } from './employee.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';

@Entity({ name: 'employee_outlet_assignments' })
export class EmployeeOutletAssignment {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() }) id: number;
  @Column({ name: 'employee_id', type: 'bigint', transformer: new BigIntTransformer() }) employeeId: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'employee_id' }) employee: Employee;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() }) outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'outlet_id' }) outlet: Outlet;
  @Column({ name: 'assigned_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true }) assignedBy: number | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt: Date;
}

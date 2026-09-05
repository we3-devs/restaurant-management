import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Employee } from './employee.entity';
import { OutletDepartment } from '../../outlet-departments/entities/outlet-department.entity';

@Entity({ name: 'employee_department_assignments' })
export class EmployeeDepartmentAssignment {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'employee_id', type: 'bigint', transformer: new BigIntTransformer() }) employeeId: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'employee_id' }) employee: Employee;
  @Column({ name: 'department_id', type: 'bigint', transformer: new BigIntTransformer() }) departmentId: number;
  @ManyToOne(() => OutletDepartment, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'department_id' }) department: OutletDepartment;
  @Column({ name: 'assigned_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true }) assignedBy: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt: Date;
}

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Employee } from '../../employees/entities/employee.entity';
import { Shift } from './shift.entity';

@Entity({ name: 'shift_assignments' })
export class ShiftAssignment {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'shift_id', type: 'bigint', transformer: new BigIntTransformer() })
  shiftId: number;
  @ManyToOne(() => Shift, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;
  @Column({ name: 'employee_id', type: 'bigint', transformer: new BigIntTransformer() })
  employeeId: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
  @Column({ name: 'assigned_date', type: 'date' })
  assignedDate: string;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @Column({ name: 'created_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  createdBy: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

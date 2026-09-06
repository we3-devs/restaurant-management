import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Employee } from '../../employees/entities/employee.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { Shift } from '../../shifts/entities/shift.entity';

export type AttendanceStatus = 'present' | 'late' | 'early_leave' | 'absent' | 'half_day';

@Entity({ name: 'attendance' })
export class Attendance {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'employee_id', type: 'bigint', transformer: new BigIntTransformer() })
  employeeId: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;
  @Column({ name: 'clock_in', type: 'timestamp' })
  clockIn: Date;
  @Column({ name: 'clock_out', type: 'timestamp', nullable: true })
  clockOut: Date | null;
  @Column({ name: 'shift_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  shiftId: number | null;
  @ManyToOne(() => Shift, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift | null;
  @Column({ type: 'varchar', length: 30, default: 'present' })
  status: AttendanceStatus;
  @Column({ name: 'is_late', type: 'boolean', default: false })
  isLate: boolean;
  @Column({ name: 'is_early_leave', type: 'boolean', default: false })
  isEarlyLeave: boolean;
  @Column({ name: 'late_minutes', type: 'integer', default: 0 })
  lateMinutes: number;
  @Column({ name: 'early_leave_minutes', type: 'integer', default: 0 })
  earlyLeaveMinutes: number;
  @Column({ name: 'working_hours', type: 'decimal', precision: 5, scale: 2, default: 0, transformer: new NumericTransformer() })
  workingHours: number;
  @Column({ type: 'text', nullable: true })
  notes: string | null;
  @Column({ name: 'adjusted_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  adjustedBy: number | null;
  @Column({ name: 'adjustment_reason', type: 'text', nullable: true })
  adjustmentReason: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { DiningTable } from '../../dining-tables/entities/dining-table.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { TableSession } from '../../table-sessions/entities/table-session.entity';

@Entity({ name: 'table_assignments' })
export class TableAssignment {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'employee_id', type: 'bigint', transformer: new BigIntTransformer() })
  employeeId: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
  @Column({ name: 'dining_table_id', type: 'bigint', transformer: new BigIntTransformer() })
  diningTableId: number;
  @ManyToOne(() => DiningTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dining_table_id' })
  diningTable: DiningTable;
  @Column({ name: 'session_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  sessionId: number | null;
  @ManyToOne(() => TableSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: TableSession | null;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;
  @Column({ name: 'assigned_at', type: 'timestamp', default: () => 'NOW()' })
  assignedAt: Date;
  @Column({ name: 'unassigned_at', type: 'timestamp', nullable: true })
  unassignedAt: Date | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @Column({ name: 'created_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  createdBy: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

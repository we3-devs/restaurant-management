import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { User } from '../../users/entities/user.entity';
import { Position } from './position.entity';

export type EmploymentStatus = 'active' | 'inactive' | 'terminated' | 'resigned';

@Entity({ name: 'employees' })
export class Employee {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'employee_code', type: 'varchar', length: 255, unique: true })
  employeeCode: string;
  @Column({ name: 'user_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  userId: number | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
  @Column({ name: 'position_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  positionId: number | null;
  @ManyToOne(() => Position, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'position_id' })
  position: Position | null;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;
  /** Direct name copy from the User entity — used when no user account is linked. */
  @Column({ type: 'varchar', length: 500 })
  name: string;
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true })
  phone: string | null;
  @Column({ name: 'photo_url', type: 'varchar', length: 1000, nullable: true })
  photoUrl: string | null;
  @Column({ name: 'joining_date', type: 'date', nullable: true })
  joiningDate: string | null;
  @Column({ name: 'employment_status', type: 'varchar', length: 30, default: 'active' })
  employmentStatus: EmploymentStatus;
  @Column({ name: 'emergency_contact_name', type: 'varchar', length: 255, nullable: true })
  emergencyContactName: string | null;
  @Column({ name: 'emergency_contact_phone', type: 'varchar', length: 100, nullable: true })
  emergencyContactPhone: string | null;
  @Column({ name: 'emergency_contact_relation', type: 'varchar', length: 100, nullable: true })
  emergencyContactRelation: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @Column({ name: 'created_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  createdBy: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

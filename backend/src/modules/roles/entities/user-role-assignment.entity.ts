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
import { OutletDepartment } from '../../outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { Role } from './role.entity';
import type { ScopeLevel } from './scope-level';

/**
 * Maps the full existing table, including the outlet/department/warehouse
 * scope columns. This foundation phase's PermissionsGuard only reads rows
 * where scopeType='global' — outlet-scoped resolution is deferred until the
 * Outlets/Warehouses domain is built.
 */
@Entity({ name: 'user_role_assignments' })
export class UserRoleAssignment {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'user_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  userId: number;

  @ManyToOne(() => User, (user) => user.roleAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'role_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  roleId: number;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({
    name: 'scope_type',
    type: 'varchar',
    length: 255,
    default: 'outlet',
  })
  scopeType: ScopeLevel;

  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  outletId: number | null;

  @ManyToOne(() => Outlet, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet | null;

  @Column({
    name: 'outlet_department_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  outletDepartmentId: number | null;

  @ManyToOne(() => OutletDepartment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_department_id' })
  outletDepartment: OutletDepartment | null;

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  warehouseId: number | null;

  @ManyToOne(() => Warehouse, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'assigned_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  assignedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by' })
  assignedByUser: User | null;

  @Column({ name: 'starts_at', type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

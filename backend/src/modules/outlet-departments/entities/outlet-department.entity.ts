import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';

export const OUTLET_DEPARTMENT_TYPES = [
  'kitchen',
  'bar',
  'grill',
  'pizza',
  'dessert',
  'drinks',
  'counter',
  'store',
  'bakery',
  'housekeeping',
  'other',
] as const;

export type OutletDepartmentType = (typeof OUTLET_DEPARTMENT_TYPES)[number];

/**
 * Stub entity — full Outlet Departments domain is out of scope for the
 * foundation phase. Exists only so FK relations from UserRoleAssignment /
 * Warehouse resolve.
 */
@Entity({ name: 'outlet_departments' })
export class OutletDepartment {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255, default: 'other' })
  type: OutletDepartmentType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'can_prepare_order', type: 'boolean', default: false })
  canPrepareOrder: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp' })
  deletedAt: Date | null;
}

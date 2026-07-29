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
import { OutletDepartment } from '../../outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';

/**
 * Stub entity — full Warehouses domain is out of scope for the foundation
 * phase. Exists only so the FK relation from UserRoleAssignment resolves.
 */
@Entity({ name: 'warehouses' })
export class Warehouse {
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

  @Column({
    name: 'outlet_department_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  outletDepartmentId: number | null;

  @ManyToOne(() => OutletDepartment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'outlet_department_id' })
  outletDepartment: OutletDepartment | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp' })
  deletedAt: Date | null;
}

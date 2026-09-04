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
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Stub entity — full Outlets domain (controllers/services) is out of scope
 * for the foundation phase. Exists only so FK relations from
 * UserRoleAssignment/OutletDepartment/Warehouse resolve.
 */
@Entity({ name: 'outlets' })
export class Outlet {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: new BigIntTransformer() })
  tenantId: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.outlets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

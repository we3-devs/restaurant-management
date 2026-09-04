import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { UserRoleAssignment } from '../../roles/entities/user-role-assignment.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ name: 'is_superadmin', type: 'boolean', default: false })
  isSuperadmin: boolean;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  tenantId: number | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({
    name: 'remember_token',
    type: 'varchar',
    length: 100,
    nullable: true,
    select: false,
  })
  rememberToken: string | null;

  @Column({
    name: 'two_factor_secret',
    type: 'text',
    nullable: true,
    select: false,
  })
  twoFactorSecret: string | null;

  @Column({
    name: 'two_factor_recovery_codes',
    type: 'text',
    nullable: true,
    select: false,
  })
  twoFactorRecoveryCodes: string | null;

  @Column({
    name: 'two_factor_confirmed_at',
    type: 'timestamp',
    nullable: true,
  })
  twoFactorConfirmedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => UserRoleAssignment, (assignment) => assignment.user)
  roleAssignments: UserRoleAssignment[];
}

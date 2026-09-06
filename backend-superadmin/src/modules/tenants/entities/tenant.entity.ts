import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'tenants' })
export class Tenant {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255, unique: true }) slug: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' }) updatedAt: Date;
  @OneToMany(() => User, (user) => user.tenant) users: User[];
  @OneToMany(() => Outlet, (outlet) => outlet.tenant) outlets: Outlet[];
}

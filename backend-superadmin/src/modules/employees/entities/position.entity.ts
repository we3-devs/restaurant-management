import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Role } from '../../roles/entities/role.entity';

@Entity({ name: 'positions' })
export class Position {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ type: 'varchar', length: 255 })
  name: string;
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;
  @Column({ type: 'text', nullable: true })
  description: string | null;
  /** Role auto-granted to a user's account when they're staffed into this position. */
  @Column({ name: 'default_role_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  defaultRoleId: number | null;
  @ManyToOne(() => Role, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'default_role_id' })
  defaultRole: Role | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

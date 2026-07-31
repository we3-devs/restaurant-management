import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

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
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

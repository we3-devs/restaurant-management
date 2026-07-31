import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';

@Entity({ name: 'shifts' })
export class Shift {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ type: 'varchar', length: 255 })
  name: string;
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;
  @Column({ name: 'end_time', type: 'time' })
  endTime: string;
  @Column({ name: 'break_duration_minutes', type: 'integer', default: 0 })
  breakDurationMinutes: number;
  @Column({ name: 'working_hours', type: 'decimal', precision: 5, scale: 2, default: 0, transformer: new NumericTransformer() })
  workingHours: number;
  @Column({ type: 'text', nullable: true })
  description: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;
  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

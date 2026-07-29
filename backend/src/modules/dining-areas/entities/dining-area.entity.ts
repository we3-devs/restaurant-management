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
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';

@Entity({ name: 'dining_areas' })
export class DiningArea {
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

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'layout_width',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 1000,
    transformer: new NumericTransformer(),
  })
  layoutWidth: number;

  @Column({
    name: 'layout_height',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 700,
    transformer: new NumericTransformer(),
  })
  layoutHeight: number;

  @Column({ name: 'sort_order', type: 'int', default: 100 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

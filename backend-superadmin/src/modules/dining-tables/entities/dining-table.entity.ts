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
import { DiningArea } from '../../dining-areas/entities/dining-area.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';

export type DiningTableStatus =
  'available' | 'occupied' | 'reserved' | 'cleaning' | 'inactive';
export type DiningTableShape = 'rectangle' | 'square' | 'circle' | 'oval';

@Entity({ name: 'dining_tables' })
export class DiningTable {
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
    name: 'dining_area_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  diningAreaId: number;

  @ManyToOne(() => DiningArea, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dining_area_id' })
  diningArea: DiningArea;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'int', default: 1 })
  capacity: number;

  @Column({ type: 'varchar', length: 255, default: 'available' })
  status: DiningTableStatus;

  @Column({
    name: 'position_x',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  positionX: number;

  @Column({
    name: 'position_y',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  positionY: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 80,
    transformer: new NumericTransformer(),
  })
  width: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 80,
    transformer: new NumericTransformer(),
  })
  height: number;

  @Column({ type: 'int', default: 0 })
  rotation: number;

  @Column({ type: 'varchar', length: 255, default: 'rectangle' })
  shape: DiningTableShape;

  @Column({ name: 'sort_order', type: 'int', default: 100 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

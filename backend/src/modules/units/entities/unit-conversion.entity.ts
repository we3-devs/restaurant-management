import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ name: 'unit_conversions' })
export class UnitConversion {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'from_unit_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  fromUnitId: number;

  @Column({
    name: 'to_unit_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  toUnitId: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 6,
    transformer: new NumericTransformer(),
  })
  multiplier: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

/** Bill-of-materials row: how much of one ingredient an addon consumes. */
@Entity({ name: 'addon_recipes' })
export class AddonRecipe {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'addon_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  addonId: number;

  @Column({
    name: 'ingredient_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientId: number;

  @Column({
    name: 'unit_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  unitId: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 4,
    transformer: new NumericTransformer(),
  })
  quantity: number;

  @Column({
    name: 'wastage_quantity',
    type: 'decimal',
    precision: 12,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  wastageQuantity: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

/**
 * Bill-of-materials row: how much of one ingredient a food (or a specific
 * variant of it) consumes. A null foodVariantId applies to the food
 * generally unless a variant-specific row for the same ingredient overrides
 * it — same override semantics as FoodOutlet.
 */
@Entity({ name: 'food_recipes' })
export class FoodRecipe {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'food_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  foodId: number;

  @Column({
    name: 'food_variant_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  foodVariantId: number | null;

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

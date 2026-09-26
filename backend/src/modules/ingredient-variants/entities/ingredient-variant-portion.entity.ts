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
 * A sellable fraction of one variant (e.g. "Quarter Peg" = 0.25 of a 250ml
 * bottle), modeled on FoodRecipe's quantity/unit shape so it can be copied
 * straight into a food_recipes row when attached to a menu item — actual
 * stock deduction at order time flows through that existing pipeline, not a
 * new one.
 */
@Entity({ name: 'ingredient_variant_portions' })
export class IngredientVariantPortion {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  tenantId: number | null;

  @Column({ name: 'ingredient_variant_id', type: 'bigint', transformer: new BigIntTransformer() })
  ingredientVariantId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'unit_id', type: 'bigint', transformer: new BigIntTransformer() })
  unitId: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 4,
    transformer: new NumericTransformer(),
  })
  quantity: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

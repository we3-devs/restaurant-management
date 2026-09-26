import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

/**
 * A size variant of a base Ingredient (e.g. "250ml" or "500ml" of "Beer"),
 * backed by its own stock-tracked Ingredient row via `ingredientId` — stock,
 * cost and barcode stay per-variant, only the grouping under `parentIngredientId`
 * is new. `unitsPerPackage`/`packageLabel` let a goods receipt be entered in
 * purchase packages (e.g. "3 cartons") and converted to this variant's own
 * base-unit quantity (see IngredientVariantsService#receiveStock).
 */
@Entity({ name: 'ingredient_variants' })
export class IngredientVariant {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  tenantId: number | null;

  @Column({ name: 'parent_ingredient_id', type: 'bigint', transformer: new BigIntTransformer() })
  parentIngredientId: number;

  @Column({ name: 'ingredient_id', type: 'bigint', transformer: new BigIntTransformer() })
  ingredientId: number;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ name: 'unit_id', type: 'bigint', transformer: new BigIntTransformer() })
  unitId: number;

  @Column({ name: 'units_per_package', type: 'int', nullable: true })
  unitsPerPackage: number | null;

  @Column({ name: 'package_label', type: 'varchar', length: 50, nullable: true })
  packageLabel: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

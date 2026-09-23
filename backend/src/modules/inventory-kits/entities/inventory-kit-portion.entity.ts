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
 * A sellable fraction of one kit item (e.g. "Quarter Peg" = 0.25 bottle),
 * modeled directly on FoodRecipe's quantity/unit shape so it can be copied
 * straight into a food_recipes row when attached to a menu item — the
 * actual stock deduction at order time flows through that existing
 * ingredient-recipe pipeline, not a new one.
 */
@Entity({ name: 'inventory_kit_portions' })
export class InventoryKitPortion {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  tenantId: number | null;

  @Column({ name: 'kit_item_id', type: 'bigint', transformer: new BigIntTransformer() })
  kitItemId: number;

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

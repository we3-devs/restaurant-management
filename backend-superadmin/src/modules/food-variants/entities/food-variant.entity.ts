import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Food } from '../../foods/entities/food.entity';
import { SubVariant } from '../../variants/entities/sub-variant.entity';
import { Variant } from '../../variants/entities/variant.entity';

/**
 * A food item: one food paired with at most one variant and at most one
 * sub-variant, and the only place a sell price lives.
 *
 * Still named `food_variants` because order_items.food_variant_id points here —
 * renaming the table would rewrite every historical order reference.
 */
@Entity({ name: 'food_variants' })
export class FoodVariant {
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

  @ManyToOne(() => Food, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'food_id' })
  food: Food;

  /**
   * The variant this item is, drawn from the global list (chicken, veg).
   * NULL for a plain item — a food with no options at all.
   */
  @Column({
    name: 'variant_id',
    type: 'bigint',
    nullable: true,
    transformer: new BigIntTransformer(),
  })
  variantId: number | null;

  @ManyToOne(() => Variant, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: Variant | null;

  /** The sub-variant, from the global list (full, half). NULL if not sized. */
  @Column({
    name: 'sub_variant_id',
    type: 'bigint',
    nullable: true,
    transformer: new BigIntTransformer(),
  })
  subVariantId: number | null;

  @ManyToOne(() => SubVariant, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sub_variant_id' })
  subVariant: SubVariant | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  sku: string | null;


  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  price: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp' })
  deletedAt: Date | null;
}

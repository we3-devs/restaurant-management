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
import { IngredientCategory } from '../../ingredient-categories/entities/ingredient-category.entity';

export type CostingMethod =
  | 'fifo'
  | 'lifo'
  | 'weighted_average'
  | 'moving_average'
  | 'specific_identification';

@Entity({ name: 'ingredients' })
export class Ingredient {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'ingredient_category_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  ingredientCategoryId: number;

  @ManyToOne(() => IngredientCategory)
  @JoinColumn({ name: 'ingredient_category_id' })
  category: IngredientCategory;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  barcode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string | null;

  @Column({
    name: 'base_unit_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  baseUnitId: number;

  @Column({
    name: 'default_purchase_unit_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  defaultPurchaseUnitId: number | null;

  @Column({
    name: 'default_usage_unit_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  defaultUsageUnitId: number | null;

  @Column({
    name: 'minimum_stock',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  minimumStock: number;

  @Column({
    name: 'reorder_level',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  reorderLevel: number;

  @Column({
    name: 'reorder_quantity',
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(),
  })
  reorderQuantity: number;

  @Column({
    name: 'costing_method',
    type: 'varchar',
    length: 30,
    default: 'fifo',
  })
  costingMethod: CostingMethod;

  @Column({ name: 'is_perishable', type: 'boolean', default: false })
  isPerishable: boolean;

  @Column({ name: 'track_expiry', type: 'boolean', default: false })
  trackExpiry: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp' })
  deletedAt: Date | null;
}

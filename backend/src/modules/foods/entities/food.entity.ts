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
import { FoodCategory } from '../../food-categories/entities/food-category.entity';
import type { OutletDepartmentType } from '../../outlet-departments/entities/outlet-department.entity';

export type FoodType = 'veg' | 'non_veg' | 'egg' | 'vegan';
export type FoodItemType = 'food' | 'beverage' | 'combo';

@Entity({ name: 'foods' })
export class Food {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'food_category_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  foodCategoryId: number | null;

  @ManyToOne(() => FoodCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'food_category_id' })
  foodCategory: FoodCategory | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  sku: string | null;

  @Column({
    name: 'short_description',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  shortDescription: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** One photo per item — variants of the same dish share it. */
  @Column({ name: 'image_url', type: 'varchar', length: 1024, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'food_type', type: 'varchar', length: 255, nullable: true })
  foodType: FoodType | null;

  @Column({ name: 'item_type', type: 'varchar', length: 255, default: 'food' })
  itemType: FoodItemType;

  /** Which outlet-department type prepares this item; null = ready-made, no kitchen prep needed. Resolved per-outlet at order time (see OrdersService#addItem). */
  @Column({ name: 'department_type', type: 'varchar', length: 255, nullable: true })
  departmentType: OutletDepartmentType | null;

  @Column({
    name: 'base_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  basePrice: number;

  @Column({ name: 'has_variants', type: 'boolean', default: false })
  hasVariants: boolean;

  @Column({ name: 'has_addons', type: 'boolean', default: false })
  hasAddons: boolean;

  @Column({ name: 'is_recipe_enabled', type: 'boolean', default: false })
  isRecipeEnabled: boolean;

  @Column({ name: 'is_taxable', type: 'boolean', default: true })
  isTaxable: boolean;

  @Column({ name: 'is_discountable', type: 'boolean', default: true })
  isDiscountable: boolean;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'preparation_time', type: 'int', nullable: true })
  preparationTime: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp' })
  deletedAt: Date | null;
}

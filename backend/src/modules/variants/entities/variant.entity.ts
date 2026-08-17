import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

/**
 * Global variant list — chicken, veg, egg. Defined once and referenced by food
 * items across every food, which is what makes "add egg once, use it
 * everywhere" possible.
 *
 * Carries no price. Price belongs to the food item (food + variant +
 * sub-variant), because the same variant costs different amounts per dish.
 */
@Entity({ name: 'variants' })
export class Variant {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Piece of the composed SKU, e.g. CHI in CHOWMIN-CHI-FULL. */
  @Column({ name: 'sku_segment', type: 'varchar', length: 32, nullable: true })
  skuSegment: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

/**
 * Global sub-variant list — full, half, quarter. Same contract as Variant: one
 * shared definition, no price, referenced by food items.
 *
 * A separate table rather than a self-referencing "kind" column on variants,
 * because the two dimensions are independent: every food item pairs at most one
 * variant with at most one sub-variant, and the pairing is what carries a price.
 */
@Entity({ name: 'sub_variants' })
export class SubVariant {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Piece of the composed SKU, e.g. FULL in CHOWMIN-CHI-FULL. */
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

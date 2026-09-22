import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

/**
 * One size variance of a kit (e.g. "250ml", "300ml", "600ml"), backed by
 * its own stock-tracked Ingredient so existing stock-in/out and costing
 * keep working unmodified.
 */
@Entity({ name: 'inventory_kit_items' })
export class InventoryKitItem {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: new BigIntTransformer() })
  tenantId: number | null;

  @Column({ name: 'kit_id', type: 'bigint', transformer: new BigIntTransformer() })
  kitId: number;

  @Column({ name: 'ingredient_id', type: 'bigint', transformer: new BigIntTransformer() })
  ingredientId: number;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ name: 'unit_id', type: 'bigint', transformer: new BigIntTransformer() })
  unitId: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

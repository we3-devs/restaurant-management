import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { PurchaseOrder } from './purchase-order.entity';

@Entity({ name: 'purchase_order_items' })
export class PurchaseOrderItem {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;

  @Column({ name: 'purchase_order_id', type: 'bigint', transformer: new BigIntTransformer() })
  purchaseOrderId: number;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'ingredient_id', type: 'bigint', transformer: new BigIntTransformer() })
  ingredientId: number;

  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: new NumericTransformer() })
  quantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 18, scale: 6, default: 0, transformer: new NumericTransformer() })
  unitCost: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  discount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  tax: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  total: number;

  @Column({ name: 'received_quantity', type: 'decimal', precision: 18, scale: 4, default: 0, transformer: new NumericTransformer() })
  receivedQuantity: number;

  @Column({ name: 'remaining_quantity', type: 'decimal', precision: 18, scale: 4, default: 0, transformer: new NumericTransformer() })
  remainingQuantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

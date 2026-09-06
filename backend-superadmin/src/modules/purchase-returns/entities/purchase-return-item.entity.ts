import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { PurchaseOrderItem } from '../../purchase-orders/entities/purchase-order-item.entity';
import { PurchaseReturn } from './purchase-return.entity';

@Entity({ name: 'purchase_return_items' })
export class PurchaseReturnItem {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'purchase_return_id', type: 'bigint', transformer: new BigIntTransformer() })
  purchaseReturnId: number;
  @ManyToOne(() => PurchaseReturn, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_return_id' })
  purchaseReturn: PurchaseReturn;
  @Column({ name: 'purchase_order_item_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  purchaseOrderItemId: number | null;
  @ManyToOne(() => PurchaseOrderItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem: PurchaseOrderItem;
  @Column({ name: 'ingredient_id', type: 'bigint', transformer: new BigIntTransformer() })
  ingredientId: number;
  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: new NumericTransformer() })
  quantity: number;
  @Column({ name: 'unit_cost', type: 'decimal', precision: 18, scale: 6, default: 0, transformer: new NumericTransformer() })
  unitCost: number;
  @Column({ name: 'total_cost', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  totalCost: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

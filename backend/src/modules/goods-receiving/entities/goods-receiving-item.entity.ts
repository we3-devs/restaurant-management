import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { PurchaseOrderItem } from '../../purchase-orders/entities/purchase-order-item.entity';
import { GoodsReceiving } from './goods-receiving.entity';

@Entity({ name: 'goods_receiving_items' })
export class GoodsReceivingItem {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'goods_receiving_id', type: 'bigint', transformer: new BigIntTransformer() })
  goodsReceivingId: number;
  @ManyToOne(() => GoodsReceiving, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goods_receiving_id' })
  goodsReceiving: GoodsReceiving;
  @Column({ name: 'purchase_order_item_id', type: 'bigint', transformer: new BigIntTransformer() })
  purchaseOrderItemId: number;
  @ManyToOne(() => PurchaseOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem: PurchaseOrderItem;
  @Column({ name: 'ingredient_id', type: 'bigint', transformer: new BigIntTransformer() })
  ingredientId: number;
  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;
  @Column({ name: 'quantity_received', type: 'decimal', precision: 18, scale: 4, default: 0, transformer: new NumericTransformer() })
  quantityReceived: number;
  @Column({ name: 'unit_cost', type: 'decimal', precision: 18, scale: 6, default: 0, transformer: new NumericTransformer() })
  unitCost: number;
  @Column({ name: 'total_cost', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: new NumericTransformer() })
  totalCost: number;
  @Column({ name: 'batch_no', type: 'varchar', length: 255, nullable: true })
  batchNo: string | null;
  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

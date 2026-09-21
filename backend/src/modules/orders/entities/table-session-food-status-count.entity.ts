import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Food } from '../../foods/entities/food.entity';
import { FoodVariant } from '../../food-variants/entities/food-variant.entity';
import { Order } from './order.entity';
import { TableSession } from '../../table-sessions/entities/table-session.entity';

/**
 * The one place an order's kitchen progress is read from: how many units of
 * each (order, food, variant) currently sit in each stage. Rows are written
 * exclusively by the sync_table_session_food_status_counts() trigger on
 * order_items (see migration 1781500000000) — the app never inserts/updates/
 * deletes this directly, which is what keeps it from drifting no matter
 * which call site touches an item next.
 *
 * Order.status and KitchenTicket.status are both derived from these counts
 * (see deriveStageFromCounts) rather than aggregated independently.
 */
@Entity({ name: 'table_session_food_status_counts' })
export class TableSessionFoodStatusCount {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'order_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    name: 'food_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  foodId: number;

  @ManyToOne(() => Food, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'food_id' })
  food: Food;

  @Column({
    name: 'food_variant_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  foodVariantId: number | null;

  @ManyToOne(() => FoodVariant, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'food_variant_id' })
  foodVariant: FoodVariant | null;

  /** Null for grab-and-go/takeaway, which has no table to roll up to. */
  @Column({
    name: 'table_session_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  tableSessionId: number | null;

  @ManyToOne(() => TableSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_session_id' })
  tableSession: TableSession | null;

  /** Still in the cart (status 'stock_reserved') — not yet sent to kitchen. */
  @Column({
    name: 'reserved_count',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  reservedCount: number;

  @Column({
    name: 'ordered_count',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  orderedCount: number;

  @Column({
    name: 'preparing_count',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  preparingCount: number;

  @Column({
    name: 'ready_count',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  readyCount: number;

  @Column({
    name: 'served_count',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  servedCount: number;

  @Column({
    name: 'cancelled_count',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  cancelledCount: number;

  /** When the earliest line of this food+variant was added — KDS aging reads this. */
  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

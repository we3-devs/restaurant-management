import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

export type CustomerCreditTransactionType =
  | 'charge'
  | 'settlement'
  | 'adjustment'
  | 'refund_reversal';

@Entity({ name: 'customer_credit_transactions' })
export class CustomerCreditTransaction {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'customer_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  customerId: number;

  @Column({
    name: 'order_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  orderId: number | null;

  @Column({
    name: 'user_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  userId: number | null;

  /**
   * Null only for pre-migration rows (see 1782200000000) that had no order
   * to backfill from. Every new charge (from the order) and settlement
   * (from the caller) is expected to carry this.
   */
  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  outletId: number | null;

  @Column({ type: 'varchar', length: 30 })
  type: CustomerCreditTransactionType;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  amount: number;

  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 18,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  balanceAfter: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

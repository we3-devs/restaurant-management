import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type LoyaltyTransactionType =
  | 'earn'
  | 'redeem'
  | 'adjustment'
  | 'expiry'
  | 'refund_reversal';

@Entity({ name: 'loyalty_transactions' })
export class LoyaltyTransaction {
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

  @Column({ type: 'varchar', length: 30 })
  type: LoyaltyTransactionType;

  @Column({ type: 'int' })
  points: number;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'is_expired', type: 'boolean', default: false })
  isExpired: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

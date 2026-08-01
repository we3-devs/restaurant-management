import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

@Entity({ name: 'loyalty_accounts' })
export class LoyaltyAccount {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'customer_id',
    type: 'bigint',
    unique: true,
    transformer: new BigIntTransformer(),
  })
  customerId: number;

  @Column({ name: 'current_points', type: 'int', default: 0 })
  currentPoints: number;

  @Column({ name: 'lifetime_earned', type: 'int', default: 0 })
  lifetimeEarned: number;

  @Column({ name: 'lifetime_redeemed', type: 'int', default: 0 })
  lifetimeRedeemed: number;

  @Column({ name: 'expiring_points', type: 'int', default: 0 })
  expiringPoints: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tier: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

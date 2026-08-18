import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity({ name: 'customer_credit_accounts' })
export class CustomerCreditAccount {
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

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  creditLimit: number;

  @Column({
    name: 'outstanding_balance',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  outstandingBalance: number;

  @Column({
    name: 'lifetime_charged',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  lifetimeCharged: number;

  @Column({
    name: 'lifetime_settled',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  lifetimeSettled: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

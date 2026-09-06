import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Customer } from '../../customers/entities/customer.entity';
import type { CustomerJwtPayload } from '../types/customer-jwt-payload';

/**
 * Customer/guest equivalent of {@link RefreshToken}. Stores only a SHA-256
 * hash of the opaque refresh token, never the raw value. `payload` is the
 * exact JWT claim set to re-mint on rotation — needed because a `guest`
 * session has no `customerId` to rebuild it from.
 */
@Entity({ name: 'customer_refresh_tokens' })
export class CustomerRefreshToken {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'customer_id',
    type: 'bigint',
    nullable: true,
    transformer: new BigIntTransformer(),
  })
  customerId: number | null;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'token_hash', type: 'varchar', length: 255, unique: true })
  tokenHash: string;

  @Column({ type: 'jsonb' })
  payload: CustomerJwtPayload;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({
    name: 'replaced_by_token_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  replacedByTokenHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

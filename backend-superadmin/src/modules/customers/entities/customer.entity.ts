import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export interface CustomerAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city?: string;
  isDefault: boolean;
}

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ name: 'welcome_bonus_granted', type: 'boolean', default: false })
  welcomeBonusGranted: boolean;

  @Column({ name: 'dietary_preferences', type: 'jsonb', nullable: true })
  dietaryPreferences: string[] | null;

  @Column({ name: 'allergies', type: 'jsonb', nullable: true })
  allergies: string[] | null;

  @Column({ name: 'favorite_food_ids', type: 'jsonb', nullable: true })
  favoriteFoodIds: number[] | null;

  @Column({ name: 'addresses', type: 'jsonb', nullable: true })
  addresses: CustomerAddress[] | null;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp' })
  deletedAt: Date | null;
}

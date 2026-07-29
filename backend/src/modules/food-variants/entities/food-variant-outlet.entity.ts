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
import { Outlet } from '../../outlets/entities/outlet.entity';
import { FoodVariant } from './food-variant.entity';

/** Per-outlet price/availability override — same semantics as FoodOutlet. */
@Entity({ name: 'food_variant_outlets' })
export class FoodVariantOutlet {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'food_variant_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  foodVariantId: number;

  @ManyToOne(() => FoodVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'food_variant_id' })
  foodVariant: FoodVariant;

  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new NumericTransformer(),
  })
  price: number | null;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

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
import { AddonGroup } from '../../addon-groups/entities/addon-group.entity';
import { Food } from './food.entity';

@Entity({ name: 'food_addon_groups' })
export class FoodAddonGroup {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

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
    name: 'addon_group_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  addonGroupId: number;

  @ManyToOne(() => AddonGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addon_group_id' })
  addonGroup: AddonGroup;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

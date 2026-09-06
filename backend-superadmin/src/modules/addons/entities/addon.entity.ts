import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { AddonGroup } from '../../addon-groups/entities/addon-group.entity';

@Entity({ name: 'addons' })
export class Addon {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'addon_group_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  addonGroupId: number | null;

  @ManyToOne(() => AddonGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'addon_group_id' })
  addonGroup: AddonGroup | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  price: number;

  @Column({ name: 'is_recipe_enabled', type: 'boolean', default: false })
  isRecipeEnabled: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp' })
  deletedAt: Date | null;
}

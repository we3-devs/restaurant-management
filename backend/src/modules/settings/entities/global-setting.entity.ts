import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type SettingsCategory =
  | 'business'
  | 'pos'
  | 'kitchen'
  | 'inventory'
  | 'reservation'
  | 'loyalty'
  | 'notification'
  | 'appearance';

@Entity({ name: 'global_settings' })
export class GlobalSetting {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  category: SettingsCategory;

  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;

  @Column({
    name: 'updated_by_user_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  updatedByUserId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

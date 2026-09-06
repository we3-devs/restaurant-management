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
import { DiningTable } from '../../dining-tables/entities/dining-table.entity';
import { Reservation } from './reservation.entity';

@Entity({ name: 'reservation_tables' })
export class ReservationTable {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'reservation_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  reservationId: number;

  @ManyToOne(() => Reservation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservation_id' })
  reservation: Reservation;

  @Column({
    name: 'dining_table_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  diningTableId: number;

  @ManyToOne(() => DiningTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dining_table_id' })
  diningTable: DiningTable;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

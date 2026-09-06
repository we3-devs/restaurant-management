import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';

export type AttendanceQrAction = 'clock-in' | 'clock-out';

@Entity({ name: 'attendance_qr_stations' })
export class AttendanceQrStation {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;

  @Column({ name: 'outlet_id', type: 'bigint', transformer: new BigIntTransformer() })
  outletId: number;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;

  @Column({ type: 'varchar', length: 20 })
  action: AttendanceQrAction;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  // Stored so an administrator can re-display the same permanent QR code.
  @Column({ type: 'varchar', length: 255, nullable: true })
  token: string | null;

  @Column({ name: 'created_by', type: 'bigint', transformer: new BigIntTransformer() })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Tenant } from '../../tenants/entities/tenant.entity';

export type QrOrderingMode = 'login' | 'quick_order';
export type QrAccessCheckMode = 'ip' | 'geofence' | 'either' | 'both';

/**
 * Stub entity — full Outlets domain (controllers/services) is out of scope
 * for the foundation phase. Exists only so FK relations from
 * UserRoleAssignment/OutletDepartment/Warehouse resolve.
 */
@Entity({ name: 'outlets' })
@Index('outlets_tenant_slug_unique', ['tenantId', 'slug'], { unique: true })
export class Outlet {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: new BigIntTransformer() })
  tenantId: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.outlets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /** Which QR ordering flow this outlet's table QR codes use — see qr-access.util.ts. */
  @Column({ name: 'qr_ordering_mode', type: 'varchar', length: 20, default: 'login' })
  qrOrderingMode: QrOrderingMode;

  /** For quick_order: which of qrAccessAllowedIp / qrAccessLatitude+Longitude+RadiusMeters must pass. */
  @Column({ name: 'qr_access_check_mode', type: 'varchar', length: 20, default: 'either' })
  qrAccessCheckMode: QrAccessCheckMode;

  @Column({ name: 'qr_access_latitude', type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: new NumericTransformer() })
  qrAccessLatitude: number | null;

  @Column({ name: 'qr_access_longitude', type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: new NumericTransformer() })
  qrAccessLongitude: number | null;

  @Column({ name: 'qr_access_radius_meters', type: 'int', nullable: true })
  qrAccessRadiusMeters: number | null;

  /** The outlet's public WAN IP, not a LAN address — req.ip only reflects the real client once main.ts's trust-proxy hop count is set correctly. */
  @Column({ name: 'qr_access_allowed_ip', type: 'varchar', length: 45, nullable: true })
  qrAccessAllowedIp: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

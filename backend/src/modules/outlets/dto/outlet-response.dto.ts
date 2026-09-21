import { ApiProperty } from '@nestjs/swagger';
import type { QrAccessCheckMode, QrOrderingMode } from '../entities/outlet.entity';

export class OutletResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['login', 'quick_order'] })
  qrOrderingMode: QrOrderingMode;

  @ApiProperty({ enum: ['ip', 'geofence', 'either', 'both'] })
  qrAccessCheckMode: QrAccessCheckMode;

  @ApiProperty({ nullable: true })
  qrAccessLatitude: number | null;

  @ApiProperty({ nullable: true })
  qrAccessLongitude: number | null;

  @ApiProperty({ nullable: true })
  qrAccessRadiusMeters: number | null;

  @ApiProperty({ nullable: true })
  qrAccessAllowedIp: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

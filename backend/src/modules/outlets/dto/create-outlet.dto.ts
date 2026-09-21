import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsIP,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { QrAccessCheckMode, QrOrderingMode } from '../entities/outlet.entity';

export class CreateOutletDto {
  @ApiProperty({ example: 'Downtown Branch' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ enum: ['login', 'quick_order'] })
  @IsOptional()
  @IsIn(['login', 'quick_order'])
  qrOrderingMode?: QrOrderingMode;

  @ApiPropertyOptional({ enum: ['ip', 'geofence', 'either', 'both'] })
  @IsOptional()
  @IsIn(['ip', 'geofence', 'either', 'both'])
  qrAccessCheckMode?: QrAccessCheckMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  qrAccessLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  qrAccessLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  qrAccessRadiusMeters?: number;

  @ApiPropertyOptional({ description: "The outlet's public WAN IP, not a LAN address" })
  @IsOptional()
  @IsIP()
  qrAccessAllowedIp?: string;
}

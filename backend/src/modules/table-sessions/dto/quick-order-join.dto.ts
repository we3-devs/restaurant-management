import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class QuickOrderJoinDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  tableCode: string;

  @ApiPropertyOptional({ description: 'Required when the outlet\'s qrAccessCheckMode needs a geofence check' })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

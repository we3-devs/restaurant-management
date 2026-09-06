import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdjustLoyaltyPointsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  customerId: number;

  @ApiProperty({ description: 'Signed point adjustment (positive or negative)' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  delta: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

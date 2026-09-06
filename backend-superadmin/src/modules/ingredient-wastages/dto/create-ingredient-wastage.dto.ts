import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

const WASTAGE_REASONS = [
  'expired',
  'damaged',
  'spoiled',
  'over_preparation',
  'staff_error',
  'other',
] as const;

export class CreateIngredientWastageDto {
  @ApiProperty()
  @IsInt()
  warehouseId: number;

  @ApiProperty({ example: '2026-07-29' })
  @IsISO8601({ strict: true })
  wastageDate: string;

  @ApiPropertyOptional({ enum: WASTAGE_REASONS, default: 'other' })
  @IsOptional()
  @IsIn(WASTAGE_REASONS)
  reason?: (typeof WASTAGE_REASONS)[number] = 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

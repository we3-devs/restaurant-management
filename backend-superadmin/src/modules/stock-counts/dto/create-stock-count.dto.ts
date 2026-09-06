import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateStockCountDto {
  @ApiProperty()
  @IsInt()
  warehouseId: number;

  @ApiProperty({ example: '2026-07-29' })
  @IsISO8601({ strict: true })
  countDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

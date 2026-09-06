import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

const STOCK_IN_SOURCES = [
  'purchase',
  'return',
  'correction',
  'donation',
  'other',
  'transfer',
] as const;

export class CreateStockInDto {
  @ApiProperty()
  @IsInt()
  warehouseId: number;

  @ApiProperty({ example: '2026-07-29' })
  @IsISO8601({ strict: true })
  stockInDate: string;

  @ApiPropertyOptional({
    enum: STOCK_IN_SOURCES,
    default: 'other',
    description:
      'Descriptive metadata only — approval always posts an opening_stock ledger entry regardless of this value.',
  })
  @IsOptional()
  @IsIn(STOCK_IN_SOURCES)
  source?: (typeof STOCK_IN_SOURCES)[number] = 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

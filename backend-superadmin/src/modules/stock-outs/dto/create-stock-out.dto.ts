import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

const STOCK_OUT_PURPOSES = [
  'production_use',
  'kitchen_use',
  'sample',
  'distribution',
  'other',
  'transfer',
] as const;

export class CreateStockOutDto {
  @ApiProperty()
  @IsInt()
  warehouseId: number;

  @ApiProperty({ example: '2026-07-29' })
  @IsISO8601({ strict: true })
  stockOutDate: string;

  @ApiPropertyOptional({
    enum: STOCK_OUT_PURPOSES,
    default: 'other',
    description:
      'Descriptive metadata only — approval always posts a production_consume ledger entry regardless of this value.',
  })
  @IsOptional()
  @IsIn(STOCK_OUT_PURPOSES)
  purpose?: (typeof STOCK_OUT_PURPOSES)[number] = 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateStockTransferDto {
  @ApiProperty()
  @IsInt()
  fromWarehouseId: number;

  @ApiProperty()
  @IsInt()
  toWarehouseId: number;

  @ApiProperty({ example: '2026-07-29' })
  @IsISO8601({ strict: true })
  transferDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

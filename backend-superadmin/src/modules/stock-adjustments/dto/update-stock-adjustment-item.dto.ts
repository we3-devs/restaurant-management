import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateStockAdjustmentItemDto {
  @ApiPropertyOptional({
    description: 're-snapshots systemQuantity from current stock when changed',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualQuantity?: number;
}

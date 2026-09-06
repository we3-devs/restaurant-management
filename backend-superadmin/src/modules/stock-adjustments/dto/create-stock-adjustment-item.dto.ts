import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockAdjustmentItemDto {
  @ApiProperty()
  @IsInt()
  ingredientId: number;

  @ApiProperty({
    description:
      'The physically counted/actual quantity. systemQuantity is snapshotted automatically from current stock at the moment this item is added.',
  })
  @IsNumber()
  @Min(0)
  actualQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

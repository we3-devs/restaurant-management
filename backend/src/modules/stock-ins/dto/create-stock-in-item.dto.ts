import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateStockInItemDto {
  @ApiProperty()
  @IsInt()
  ingredientId: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number = 0;
}

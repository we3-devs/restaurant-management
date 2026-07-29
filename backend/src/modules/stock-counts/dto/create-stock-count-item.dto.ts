import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockCountItemDto {
  @ApiProperty()
  @IsInt()
  ingredientId: number;

  @ApiProperty({
    description:
      'The physically counted quantity. systemQuantity/differenceQuantity are only computed when the count is completed, not when this item is added.',
  })
  @IsNumber()
  @Min(0)
  countedQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

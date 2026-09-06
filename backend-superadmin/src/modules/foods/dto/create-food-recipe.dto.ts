import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateFoodRecipeDto {
  @ApiPropertyOptional({
    description:
      'Omit to apply to the food generally; set to override for one specific variant.',
  })
  @IsOptional()
  @IsInt()
  foodVariantId?: number;

  @ApiProperty()
  @IsInt()
  ingredientId: number;

  @ApiProperty()
  @IsInt()
  unitId: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wastageQuantity?: number = 0;
}

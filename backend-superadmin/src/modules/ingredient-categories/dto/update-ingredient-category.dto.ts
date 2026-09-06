import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateIngredientCategoryDto } from './create-ingredient-category.dto';

// slug is immutable after creation — omitted entirely, not just optional.
export class UpdateIngredientCategoryDto extends PartialType(
  OmitType(CreateIngredientCategoryDto, ['slug'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

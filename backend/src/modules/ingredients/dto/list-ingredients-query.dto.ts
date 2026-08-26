import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { INGREDIENT_TYPES } from '../../ingredient-categories/ingredient-category-type.util';
import type { IngredientType } from '../../ingredient-categories/ingredient-category-type.util';

export class ListIngredientsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ingredientCategoryId?: number;

  @ApiPropertyOptional({
    enum: INGREDIENT_TYPES,
    description: "Filters by the ingredient's category's type.",
  })
  @IsOptional()
  @IsIn(INGREDIENT_TYPES)
  type?: IngredientType;

  @ApiPropertyOptional({
    description:
      "When true, only return ingredients whose category's type supports stock tracking (beverage, packaging, consumable).",
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  trackableOnly?: boolean;
}

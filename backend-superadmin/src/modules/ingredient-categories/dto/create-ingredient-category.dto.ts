import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INGREDIENT_TYPES } from '../ingredient-category-type.util';
import type { IngredientType } from '../ingredient-category-type.util';

export class CreateIngredientCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ example: 'Vegetables' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'vegetables' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, alphanumeric, hyphen-separated',
  })
  @MaxLength(255)
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({
    enum: INGREDIENT_TYPES,
    description:
      'Determines whether ingredients in this category get real warehouse stock tracking.',
  })
  @IsIn(INGREDIENT_TYPES)
  type: IngredientType;
}

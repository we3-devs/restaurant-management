import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const INGREDIENT_TYPES = [
  'raw_material',
  'ready_product',
  'packaging',
  'consumable',
] as const;

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

  @ApiPropertyOptional({ enum: INGREDIENT_TYPES })
  @IsOptional()
  @IsIn(INGREDIENT_TYPES)
  type?: (typeof INGREDIENT_TYPES)[number];
}

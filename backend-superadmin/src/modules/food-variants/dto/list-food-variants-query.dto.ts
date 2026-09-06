import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListFoodVariantsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  foodId?: number;

  @ApiPropertyOptional({ description: 'Filter food items by global variant.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  variantId?: number;

  @ApiPropertyOptional({ description: 'Filter food items by global sub-variant.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subVariantId?: number;
}

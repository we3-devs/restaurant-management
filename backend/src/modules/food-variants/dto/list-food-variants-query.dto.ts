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

  @ApiPropertyOptional({
    description:
      'Restrict to children of this variant. Use topLevelOnly for the other side of the tree.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;
}

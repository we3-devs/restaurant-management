import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const WASTAGE_STATUSES = ['draft', 'approved', 'cancelled'] as const;

export class ListIngredientWastagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional({ enum: WASTAGE_STATUSES })
  @IsOptional()
  @IsIn(WASTAGE_STATUSES)
  status?: (typeof WASTAGE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

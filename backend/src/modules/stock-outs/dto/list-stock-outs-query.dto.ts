import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const STOCK_OUT_STATUSES = ['draft', 'approved', 'cancelled'] as const;

export class ListStockOutsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional({ enum: STOCK_OUT_STATUSES })
  @IsOptional()
  @IsIn(STOCK_OUT_STATUSES)
  status?: (typeof STOCK_OUT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

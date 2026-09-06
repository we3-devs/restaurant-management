import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { DiningTableStatus } from '../entities/dining-table.entity';

const DINING_TABLE_STATUSES: DiningTableStatus[] = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'inactive',
];

export class ListDiningTablesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  outletId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diningAreaId?: number;

  @ApiPropertyOptional({ enum: DINING_TABLE_STATUSES })
  @IsOptional()
  @IsIn(DINING_TABLE_STATUSES)
  status?: DiningTableStatus;
}

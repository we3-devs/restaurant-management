import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { TableSessionStatus } from '../entities/table-session.entity';

const TABLE_SESSION_STATUSES: TableSessionStatus[] = [
  'active',
  'billing',
  'completed',
  'cancelled',
];

export class ListTableSessionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  outletId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diningTableId?: number;

  @ApiPropertyOptional({ enum: TABLE_SESSION_STATUSES })
  @IsOptional()
  @IsIn(TABLE_SESSION_STATUSES)
  status?: TableSessionStatus;
}

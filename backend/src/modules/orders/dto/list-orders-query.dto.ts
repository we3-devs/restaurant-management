import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { OrderStatus } from '../entities/order.entity';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'partially_ready',
  'ready',
  'partially_served',
  'served',
  'completed',
  'cancelled',
];

export class ListOrdersQueryDto extends PaginationQueryDto {
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
  tableSessionId?: number;

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  /** Comma-separated statuses to leave out (e.g. "completed,cancelled" for an "open orders" view). Ignored if `status` is set. */
  @ApiPropertyOptional({ type: String, description: 'Comma-separated statuses to exclude' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsIn(ORDER_STATUSES, { each: true })
  excludeStatus?: OrderStatus[];

  @ApiPropertyOptional({ description: 'Inclusive ISO timestamp lower bound for createdAt' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Exclusive ISO timestamp upper bound for createdAt' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
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

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import type { OrderType } from '../entities/order.entity';

const ORDER_TYPES: OrderType[] = ['dine_in', 'takeaway', 'delivery'];

export class CreateOrderDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tableSessionId?: number;

  @ApiPropertyOptional({ enum: ORDER_TYPES, default: 'dine_in' })
  @IsOptional()
  @IsIn(ORDER_TYPES)
  orderType?: OrderType = 'dine_in';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

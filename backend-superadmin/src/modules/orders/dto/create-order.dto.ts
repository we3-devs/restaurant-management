import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import type { OrderType } from '../entities/order.entity';

const ORDER_TYPES: OrderType[] = ['grab_and_go', 'table', 'stay', 'delivery'];

export class CreateOrderDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tableSessionId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  reservationId?: number;

  @ApiPropertyOptional({ enum: ORDER_TYPES, default: 'table' })
  @IsOptional()
  @IsIn(ORDER_TYPES)
  orderType?: OrderType = 'table';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

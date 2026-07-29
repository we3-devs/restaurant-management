import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { OrderDiscountType } from '../entities/order.entity';

const ORDER_DISCOUNT_TYPES: OrderDiscountType[] = ['flat', 'percentage'];

// Editing these fields triggers OrdersService.recalculateTotals(). Items,
// status, and table assignment are edited through their own sub-resources.
export class UpdateOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: ORDER_DISCOUNT_TYPES })
  @IsOptional()
  @IsIn(ORDER_DISCOUNT_TYPES)
  discountType?: OrderDiscountType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceChargeAmount?: number;
}

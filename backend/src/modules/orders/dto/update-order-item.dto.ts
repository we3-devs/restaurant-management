import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { OrderItemStatus } from '../entities/order-item.entity';

const ORDER_ITEM_STATUSES: OrderItemStatus[] = [
  'stock_reserved',
  'sent_to_kitchen',
  'preparing',
  'ready',
  'served',
  'cancelled',
];

// foodId/foodVariantId/orderId/preparationDepartmentId are immutable after
// creation — this only covers what a staff member can actually edit in place.
export class UpdateOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: ORDER_ITEM_STATUSES })
  @IsOptional()
  @IsIn(ORDER_ITEM_STATUSES)
  status?: OrderItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelReason?: string;

  @ApiPropertyOptional({
    description:
      'Fire/Hold: holds the item in the cart instead of sending it with the rest of the order (only while status is stock_reserved)',
  })
  @IsOptional()
  @IsBoolean()
  isHeld?: boolean;
}

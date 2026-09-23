import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
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

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Recorded on the order_status_histories row',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Required in spirit for cancellations, not enforced',
  })
  @IsOptional()
  @IsString()
  cancelReason?: string;

  @ApiPropertyOptional({
    description:
      'status="completed" only. Closes the order out even though some items never reached "served" — those items are voided (reservations released, marked cancelled, dropped from the bill) instead of left dangling. Requires orders.delete.',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    description:
      'status="completed" only. Closes the order out even though some items never reached "served", by marking those items served first instead of voiding them — the sale still charges and consumes stock for them normally. Mutually exclusive with force in effect (a truthy force takes precedence). No extra permission beyond orders.manage.',
  })
  @IsOptional()
  @IsBoolean()
  autoServe?: boolean;
}

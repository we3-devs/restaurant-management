import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { OrderPaymentMethod } from '../entities/order-payment.entity';

const ORDER_PAYMENT_METHODS: OrderPaymentMethod[] = [
  'cash',
  'card',
  'online',
  'credit',
  'other',
];

/**
 * One combined payment across every open order on a table session (pays
 * off the oldest order's balance first — see
 * OrderPaymentsService#payForTableSession) — always type 'payment', unlike
 * CreateOrderPaymentDto: refunding "the table" as a single concept doesn't
 * make sense once the underlying orders have gone their separate ways.
 */
export class CreateTableSessionPaymentDto {
  @ApiPropertyOptional({ enum: ORDER_PAYMENT_METHODS, default: 'cash' })
  @IsOptional()
  @IsIn(ORDER_PAYMENT_METHODS)
  method?: OrderPaymentMethod = 'cash';

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

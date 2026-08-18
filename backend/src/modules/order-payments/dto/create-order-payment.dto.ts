import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import type {
  OrderPaymentMethod,
  OrderPaymentType,
} from '../entities/order-payment.entity';

const ORDER_PAYMENT_TYPES: OrderPaymentType[] = ['payment', 'refund'];
const ORDER_PAYMENT_METHODS: OrderPaymentMethod[] = [
  'cash',
  'card',
  'online',
  'credit',
  'other',
];

export class CreateOrderPaymentDto {
  @ApiPropertyOptional({ enum: ORDER_PAYMENT_TYPES, default: 'payment' })
  @IsOptional()
  @IsIn(ORDER_PAYMENT_TYPES)
  type?: OrderPaymentType = 'payment';

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
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Required when method="credit" — the customer whose tab is charged' })
  @ValidateIf((dto) => dto.method === 'credit')
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}

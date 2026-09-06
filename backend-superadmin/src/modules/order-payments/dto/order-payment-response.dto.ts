import { ApiProperty } from '@nestjs/swagger';
import type {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderPaymentType,
} from '../entities/order-payment.entity';

export class OrderPaymentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  orderId: number;

  @ApiProperty()
  paymentNumber: string;

  @ApiProperty()
  type: OrderPaymentType;

  @ApiProperty()
  method: OrderPaymentMethod;

  @ApiProperty({ required: false, nullable: true })
  provider: string | null;

  @ApiProperty({ required: false, nullable: true })
  transactionReference: string | null;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: OrderPaymentStatus;

  @ApiProperty({ required: false, nullable: true })
  note: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

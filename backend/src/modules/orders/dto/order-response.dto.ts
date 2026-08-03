import { ApiProperty } from '@nestjs/swagger';
import type {
  OrderApprovalStatus,
  OrderChannel,
  OrderDiscountType,
  OrderPaymentStatus,
  OrderSourceChannel,
  OrderStatus,
  OrderType,
} from '../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty({ required: false, nullable: true })
  tableSessionId: number | null;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ required: false, nullable: true, description: 'Guest-facing bill number — see OrdersService#generateBillNumber' })
  billNumber: string | null;

  @ApiProperty()
  orderType: OrderType;

  @ApiProperty()
  source: OrderSourceChannel;

  @ApiProperty()
  orderSource: OrderChannel;

  @ApiProperty()
  status: OrderStatus;

  @ApiProperty()
  paymentStatus: OrderPaymentStatus;

  @ApiProperty()
  approvalStatus: OrderApprovalStatus;

  @ApiProperty({ required: false, nullable: true })
  note: string | null;

  @ApiProperty()
  subtotal: number;

  @ApiProperty({ required: false, nullable: true })
  discountType: OrderDiscountType | null;

  @ApiProperty()
  discountValue: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  serviceChargeAmount: number;

  @ApiProperty()
  taxAmount: number;

  @ApiProperty()
  grandTotal: number;

  @ApiProperty()
  paidAmount: number;

  @ApiProperty()
  dueAmount: number;

  @ApiProperty()
  refundedAmount: number;

  @ApiProperty({ required: false, nullable: true })
  completedAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  cancelledAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

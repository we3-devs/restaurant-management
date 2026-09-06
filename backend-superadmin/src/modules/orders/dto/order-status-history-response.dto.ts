import { ApiProperty } from '@nestjs/swagger';
import type { OrderStatus } from '../entities/order.entity';

export class OrderStatusHistoryResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  orderId: number;

  @ApiProperty({ required: false, nullable: true })
  changedBy: number | null;

  @ApiProperty({ required: false, nullable: true })
  fromStatus: OrderStatus | null;

  @ApiProperty()
  toStatus: OrderStatus;

  @ApiProperty({ required: false, nullable: true })
  note: string | null;

  @ApiProperty()
  createdAt: Date;
}

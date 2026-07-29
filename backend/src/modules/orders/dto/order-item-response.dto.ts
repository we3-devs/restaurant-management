import { ApiProperty } from '@nestjs/swagger';
import type { OrderItemStatus } from '../entities/order-item.entity';

export class OrderItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  orderId: number;

  @ApiProperty()
  foodId: number;

  @ApiProperty({ required: false, nullable: true })
  foodVariantId: number | null;

  @ApiProperty()
  preparationDepartmentId: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  taxAmount: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  status: OrderItemStatus;

  @ApiProperty({ required: false, nullable: true })
  note: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

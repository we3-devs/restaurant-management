import { ApiProperty } from '@nestjs/swagger';

export class OrderItemAddonResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  orderItemId: number;

  @ApiProperty()
  addonId: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

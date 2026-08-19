import { ApiProperty } from '@nestjs/swagger';
import type {
  OrderItemPackagingType,
  OrderItemStatus,
} from '../entities/order-item.entity';

/**
 * One addon line on a WaiterOrderItemResponseDto — same minimal shape as the
 * parent: the id a caller might act on (removeAddon), the price fields a
 * bill needs, and the name so no follow-up /addons request is required.
 */
export class WaiterOrderItemAddonResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  addonId: number;

  @ApiProperty()
  addonName: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalAmount: number;
}

/**
 * The shape GET /order-items actually returns. Deliberately smaller than the
 * OrderItem entity: no createdAt/updatedAt/cancelReason/preparationDepartmentId
 * (internal bookkeeping a waiter's cart/order-detail row never renders), and
 * food/variant names are resolved server-side and embedded — the whole point
 * being that a waiter screen can render every row from this one response,
 * without a second request just to turn foodId/foodVariantId into text.
 */
export class WaiterOrderItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  orderId: number;

  @ApiProperty()
  foodId: number;

  @ApiProperty()
  foodName: string;

  @ApiProperty({ required: false, nullable: true })
  foodVariantId: number | null;

  @ApiProperty({ required: false, nullable: true })
  variantName: string | null;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  status: OrderItemStatus;

  @ApiProperty()
  isHeld: boolean;

  @ApiProperty({ required: false, nullable: true })
  note: string | null;

  @ApiProperty()
  packagingType: OrderItemPackagingType;

  @ApiProperty({ type: [WaiterOrderItemAddonResponseDto] })
  addons: WaiterOrderItemAddonResponseDto[];
}

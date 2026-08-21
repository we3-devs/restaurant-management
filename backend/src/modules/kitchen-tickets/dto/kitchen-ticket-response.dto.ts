import { ApiProperty } from '@nestjs/swagger';
import type {
  KitchenTicketPriority,
  KitchenTicketStatus,
} from '../entities/kitchen-ticket.entity';
import type { KitchenTicketItemStatus } from '../entities/kitchen-ticket-item.entity';

/** Minimal food/variant name lookup so the KDS board never needs a follow-up request just to render a row. */
export class KitchenTicketFoodRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class KitchenTicketOrderItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  foodId: number;

  @ApiProperty({ required: false, nullable: true })
  foodVariantId: number | null;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty({ required: false, nullable: true })
  note: string | null;

  @ApiProperty({ type: KitchenTicketFoodRefDto, required: false })
  food?: KitchenTicketFoodRefDto;

  @ApiProperty({ type: KitchenTicketFoodRefDto, required: false, nullable: true })
  foodVariant?: KitchenTicketFoodRefDto | null;
}

export class KitchenTicketItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  ticketId: number;

  @ApiProperty()
  orderItemId: number;

  @ApiProperty()
  status: KitchenTicketItemStatus;

  @ApiProperty({ required: false, nullable: true })
  startedAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  readyAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  servedAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  recalledAt: Date | null;

  @ApiProperty()
  recallCount: number;

  @ApiProperty({ type: KitchenTicketOrderItemResponseDto, required: false })
  orderItem?: KitchenTicketOrderItemResponseDto;
}

export class KitchenTicketDepartmentRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class KitchenTicketDiningTableRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class KitchenTicketTableSessionRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ type: KitchenTicketDiningTableRefDto, required: false })
  diningTable?: KitchenTicketDiningTableRefDto;
}

export class KitchenTicketOrderRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ type: KitchenTicketTableSessionRefDto, required: false, nullable: true })
  tableSession?: KitchenTicketTableSessionRefDto | null;
}

/**
 * Shape returned by every kitchen-tickets endpoint. Trimmed to what the KDS
 * board (packages/api-client/src/hooks/use-kitchen-tickets.ts) actually
 * renders — order/department/items are only populated where the source
 * query loaded those relations (currently just GET /kitchen-tickets/bootstrap).
 */
export class KitchenTicketResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  orderId: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty({ required: false, nullable: true })
  departmentId: number | null;

  @ApiProperty()
  status: KitchenTicketStatus;

  @ApiProperty()
  priority: KitchenTicketPriority;

  @ApiProperty({ required: false, nullable: true })
  startedAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  readyAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  servedAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  recalledAt: Date | null;

  @ApiProperty()
  recallCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: KitchenTicketDepartmentRefDto, required: false, nullable: true })
  department?: KitchenTicketDepartmentRefDto | null;

  @ApiProperty({ type: [KitchenTicketItemResponseDto], required: false })
  items?: KitchenTicketItemResponseDto[];

  @ApiProperty({ type: KitchenTicketOrderRefDto, required: false })
  order?: KitchenTicketOrderRefDto;
}

export class KdsBootstrapStationResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  canPrepareOrder: boolean;
}

export class KdsBootstrapResponseDto {
  @ApiProperty({ type: [KdsBootstrapStationResponseDto] })
  stations: KdsBootstrapStationResponseDto[];

  @ApiProperty({ type: [KitchenTicketResponseDto] })
  tickets: KitchenTicketResponseDto[];
}

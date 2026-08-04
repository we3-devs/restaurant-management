import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { OrderType } from '../../orders/entities/order.entity';
import type { TableSessionSource } from '../entities/table-session.entity';

const TABLE_SESSION_SOURCES: TableSessionSource[] = [
  'walk_in',
  'reservation',
  'qr_order',
  'staff',
];
const ORDER_TYPES: OrderType[] = ['grab_and_go', 'table', 'stay', 'delivery'];

/**
 * Body for POST /table-sessions/open — opens a table session and creates
 * its first order atomically in one request (see
 * OrdersService#openTableWithOrder). Superset of CreateTableSessionDto +
 * the CreateOrderDto fields that make sense to set up front (orderType,
 * note); tableSessionId/customerId/reservationId/outletId are shared
 * between the two rows this creates, so they're specified once here.
 */
export class OpenTableSessionDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiProperty()
  @IsInt()
  diningTableId: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number = 1;

  @ApiPropertyOptional({ enum: TABLE_SESSION_SOURCES, default: 'staff' })
  @IsOptional()
  @IsIn(TABLE_SESSION_SOURCES)
  source?: TableSessionSource = 'staff';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  reservationId?: number;

  @ApiPropertyOptional({ enum: ORDER_TYPES, default: 'table' })
  @IsOptional()
  @IsIn(ORDER_TYPES)
  orderType?: OrderType = 'table';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { KitchenTicketItemStatus } from '../entities/kitchen-ticket-item.entity';

const STATUSES: KitchenTicketItemStatus[] = [
  'sent_to_kitchen',
  'preparing',
  'ready',
  'served',
  'cancelled',
];

export class UpdateKitchenTicketItemStatusDto {
  @ApiProperty({ enum: STATUSES })
  @IsIn(STATUSES)
  status: KitchenTicketItemStatus;
}

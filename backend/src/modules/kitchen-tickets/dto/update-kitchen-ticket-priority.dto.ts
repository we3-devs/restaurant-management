import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { KitchenTicketPriority } from '../entities/kitchen-ticket.entity';

const PRIORITIES: KitchenTicketPriority[] = ['normal', 'high', 'urgent'];

export class UpdateKitchenTicketPriorityDto {
  @ApiProperty({ enum: PRIORITIES })
  @IsIn(PRIORITIES)
  priority: KitchenTicketPriority;
}

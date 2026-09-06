import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { ReservationStatus } from '../entities/reservation.entity';

const RESERVATION_STATUSES: ReservationStatus[] = [
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no_show',
];

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: RESERVATION_STATUSES })
  @IsIn(RESERVATION_STATUSES)
  status: ReservationStatus;
}

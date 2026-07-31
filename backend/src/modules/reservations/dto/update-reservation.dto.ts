import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { ReservationDepositStatus } from '../entities/reservation.entity';
import { CreateReservationDto } from './create-reservation.dto';

const DEPOSIT_STATUSES: ReservationDepositStatus[] = [
  'not_required',
  'pending',
  'paid',
  'refunded',
  'forfeited',
];

// outletId/customerId are immutable after creation — omitted entirely.
export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, ['outletId', 'customerId'] as const),
) {
  @ApiPropertyOptional({ enum: DEPOSIT_STATUSES })
  @IsOptional()
  @IsIn(DEPOSIT_STATUSES)
  depositStatus?: ReservationDepositStatus;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { ReservationSource } from '../entities/reservation.entity';

const RESERVATION_SOURCES: ReservationSource[] = [
  'walk_in',
  'phone',
  'online',
  'staff',
  'other',
];

export class CreateReservationDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiProperty()
  @IsInt()
  customerId: number;

  @ApiProperty()
  @IsDateString()
  reservedAt: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number = 1;

  @ApiPropertyOptional({ enum: RESERVATION_SOURCES, default: 'staff' })
  @IsOptional()
  @IsIn(RESERVATION_SOURCES)
  source?: ReservationSource = 'staff';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialRequest?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNote?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;
}

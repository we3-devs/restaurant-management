import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { TableSessionSource } from '../entities/table-session.entity';

const TABLE_SESSION_SOURCES: TableSessionSource[] = [
  'walk_in',
  'reservation',
  'qr_order',
  'staff',
];

export class CreateTableSessionDto {
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
}

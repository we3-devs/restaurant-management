import { ApiProperty } from '@nestjs/swagger';
import type {
  TableSessionSource,
  TableSessionStatus,
} from '../entities/table-session.entity';

export class TableSessionResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  diningTableId: number;

  @ApiProperty()
  guestCount: number;

  @ApiProperty()
  source: TableSessionSource;

  @ApiProperty()
  status: TableSessionStatus;

  @ApiProperty({ required: false, nullable: true })
  startedAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  endedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

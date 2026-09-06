import { ApiProperty } from '@nestjs/swagger';
import type {
  TableSessionSource,
  TableSessionStatus,
} from '../entities/table-session.entity';

export class TableSessionCustomerSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  loyaltyTier: string | null;
}

export class TableSessionResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  diningTableId: number;

  @ApiProperty()
  guestCount: number;

  @ApiProperty({ nullable: true })
  customerId: number | null;

  @ApiProperty({ type: TableSessionCustomerSummaryDto, nullable: true })
  customer: TableSessionCustomerSummaryDto | null;

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

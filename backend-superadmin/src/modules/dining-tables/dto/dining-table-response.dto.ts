import { ApiProperty } from '@nestjs/swagger';
import type {
  DiningTableShape,
  DiningTableStatus,
} from '../entities/dining-table.entity';

export class DiningTableResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  diningAreaId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  code: string | null;

  @ApiProperty()
  capacity: number;

  @ApiProperty()
  status: DiningTableStatus;

  @ApiProperty()
  shape: DiningTableShape;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

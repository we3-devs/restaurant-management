import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { DiningTableStatus } from '../entities/dining-table.entity';
import { CreateDiningTableDto } from './create-dining-table.dto';

const DINING_TABLE_STATUSES: DiningTableStatus[] = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'inactive',
];

// outletId/diningAreaId are immutable after creation — omitted entirely.
export class UpdateDiningTableDto extends PartialType(
  OmitType(CreateDiningTableDto, ['outletId', 'diningAreaId'] as const),
) {
  @ApiPropertyOptional({ enum: DINING_TABLE_STATUSES })
  @IsOptional()
  @IsIn(DINING_TABLE_STATUSES)
  status?: DiningTableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

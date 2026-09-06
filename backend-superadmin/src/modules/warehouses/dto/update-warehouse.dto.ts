import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWarehouseDto } from './create-warehouse.dto';

// outletId is immutable after creation — omitted entirely, not just optional.
export class UpdateWarehouseDto extends PartialType(
  OmitType(CreateWarehouseDto, ['outletId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

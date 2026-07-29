import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateDiningAreaDto } from './create-dining-area.dto';

// outletId is immutable after creation — omitted entirely, not just optional.
export class UpdateDiningAreaDto extends PartialType(
  OmitType(CreateDiningAreaDto, ['outletId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

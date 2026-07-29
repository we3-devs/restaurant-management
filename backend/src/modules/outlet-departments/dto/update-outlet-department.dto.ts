import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOutletDepartmentDto } from './create-outlet-department.dto';

// outletId is immutable after creation — omitted entirely, not just optional.
export class UpdateOutletDepartmentDto extends PartialType(
  OmitType(CreateOutletDepartmentDto, ['outletId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

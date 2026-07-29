import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRoleDto } from './create-role.dto';

// Slug is immutable after creation — omitted entirely, not just optional.
export class UpdateRoleDto extends PartialType(
  OmitType(CreateRoleDto, ['slug'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

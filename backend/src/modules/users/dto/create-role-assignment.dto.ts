import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

// scopeType is hardcoded 'global' server-side — never client-supplied, since
// outlet/department/warehouse-scoped assignments are inert until the
// Outlets domain's permission resolution lands.
export class CreateRoleAssignmentDto {
  @ApiProperty()
  @IsInt()
  roleId: number;
}

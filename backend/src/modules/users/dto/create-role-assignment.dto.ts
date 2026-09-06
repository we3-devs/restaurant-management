import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class CreateRoleAssignmentDto {
  @ApiProperty()
  @IsInt()
  roleId: number;

  @ApiProperty({ required: false, description: 'Limit this role assignment to one outlet. Omit for global access.' })
  @IsOptional()
  @IsInt()
  outletId?: number;
}

import { ApiProperty } from '@nestjs/swagger';

export class RoleAssignmentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  roleId: number;

  @ApiProperty()
  roleName: string;

  @ApiProperty()
  roleSlug: string;

  @ApiProperty()
  scopeType: string;

  @ApiProperty({ nullable: true })
  outletId: number | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

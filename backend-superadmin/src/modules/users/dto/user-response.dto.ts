import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true, description: 'The linked employee record, if this user is staff.' })
  employeeId: number | null;

  @ApiProperty({ nullable: true })
  outletId: number | null;

  @ApiProperty({ nullable: true })
  departmentId: number | null;

  @ApiProperty()
  isSuperadmin: boolean;

  // Computed from whether the user has any active, in-window role
  // assignment — there is no `is_active`/`deleted_at` column on `users`.
  @ApiProperty({
    description:
      'Computed: true if the user has at least one active role assignment',
  })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

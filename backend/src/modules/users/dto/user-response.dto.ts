import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

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

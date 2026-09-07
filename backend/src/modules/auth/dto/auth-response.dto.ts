import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isSuperadmin: boolean;

  @ApiProperty({ enum: ['dashboard', 'staff'] })
  portal: 'dashboard' | 'staff';

  @ApiProperty({
    description: 'Whether the user can reach both the dashboard and staff apps (drives the header portal switcher)',
  })
  hasBothPortals: boolean;

  @ApiProperty({
    type: [Number],
    description:
      'Outlet IDs accessible to the user. An empty array means no assigned outlets or global/unscoped access, matching /outlets/assigned.',
  })
  outletIds: number[];
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

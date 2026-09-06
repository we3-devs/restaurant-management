import { ApiProperty } from '@nestjs/swagger';
import type { PortalAccess } from '../entities/portal-access';
import type { ScopeLevel } from '../entities/scope-level';

export class RoleResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  level: ScopeLevel;

  @ApiProperty()
  rank: number;

  @ApiProperty({ enum: ['dashboard', 'staff', 'both'] })
  portal: PortalAccess;

  @ApiProperty()
  isAssignable: boolean;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty({ type: [String], required: false })
  permissions?: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

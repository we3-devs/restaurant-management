import { ApiProperty } from '@nestjs/swagger';
import type { ScopeLevel } from '../entities/scope-level';

export class PermissionResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  module: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  level: ScopeLevel;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;
}

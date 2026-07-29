import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Shift Manager' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'shift-manager' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, alphanumeric, hyphen-separated',
  })
  @MaxLength(255)
  slug: string;

  // Restricted to 'global' this phase — outlet/department/warehouse-scoped
  // roles would be inert since PermissionsGuard only resolves global-scope
  // assignments until the Outlets domain lands.
  @ApiPropertyOptional({ enum: ['global'], default: 'global' })
  @IsOptional()
  @IsIn(['global'])
  level?: 'global' = 'global' as const;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  rank?: number = 100;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAssignable?: boolean = true;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

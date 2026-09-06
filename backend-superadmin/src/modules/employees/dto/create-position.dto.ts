import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreatePositionDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ description: 'Role auto-granted to a user staffed into this position' })
  @IsOptional() @Type(() => Number) @IsInt() defaultRoleId?: number;
}

export class UpdatePositionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: boolean;
  @ApiPropertyOptional({ description: 'Role auto-granted to a user staffed into this position' })
  @IsOptional() @Type(() => Number) @IsInt() defaultRoleId?: number | null;
}

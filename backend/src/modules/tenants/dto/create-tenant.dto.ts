import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Demo Hotel' })
  @IsString() @MinLength(2) @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'demo' })
  @IsString() @Matches(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
  slug: string;
}

export class UpdateTenantDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

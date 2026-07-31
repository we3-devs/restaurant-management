import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePositionDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdatePositionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: boolean;
}

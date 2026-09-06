import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateShiftDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty({ example: '09:00' }) @IsString() startTime: string;
  @ApiProperty({ example: '17:00' }) @IsString() endTime: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() breakDurationMinutes?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() workingHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
}

export class UpdateShiftDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endTime?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() breakDurationMinutes?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() workingHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() positionId?: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() departmentId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) joiningDate?: string;
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'terminated', 'resigned'] }) @IsOptional() @IsIn(['active', 'inactive', 'terminated', 'resigned']) employmentStatus?: 'active' | 'inactive' | 'terminated' | 'resigned';
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactRelation?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() positionId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() departmentId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) joiningDate?: string;
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'terminated', 'resigned'] }) @IsOptional() @IsIn(['active', 'inactive', 'terminated', 'resigned']) employmentStatus?: 'active' | 'inactive' | 'terminated' | 'resigned';
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactRelation?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['active', 'inactive']) isActive?: boolean;
}

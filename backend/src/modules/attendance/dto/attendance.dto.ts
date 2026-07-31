import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class ClockInDto {
  @ApiProperty() @Type(() => Number) @IsInt() employeeId: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() shiftId?: number;
}

export class ClockOutDto {
  @ApiProperty() @Type(() => Number) @IsInt() attendanceId: number;
}

export class AdjustAttendanceDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) clockIn?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) clockOut?: Date;
  @ApiPropertyOptional({ enum: ['present', 'late', 'early_leave', 'absent', 'half_day'] }) @IsOptional() @IsIn(['present', 'late', 'early_leave', 'absent', 'half_day']) status?: 'present' | 'late' | 'early_leave' | 'absent' | 'half_day';
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListAttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() employeeId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() outletId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() shiftId?: number;
  @ApiPropertyOptional({ enum: ['present', 'late', 'early_leave', 'absent', 'half_day'] }) @IsOptional() @IsIn(['present', 'late', 'early_leave', 'absent', 'half_day']) status?: 'present' | 'late' | 'early_leave' | 'absent' | 'half_day';
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

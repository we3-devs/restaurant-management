import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListEmployeesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() outletId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() positionId?: number;
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'terminated', 'resigned'] }) @IsOptional() @IsIn(['active', 'inactive', 'terminated', 'resigned']) employmentStatus?: 'active' | 'inactive' | 'terminated' | 'resigned';
}

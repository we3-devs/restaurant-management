import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Optional requested outlet; access is always checked server-side.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  outletId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional({ description: 'ISO date, inclusive.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive.' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderType?: string;
}

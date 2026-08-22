import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { PeriodType } from '../entities/period-insight.entity';

export class PeriodInsightsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  outletId?: number;

  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly'] })
  @IsIn(['daily', 'weekly', 'monthly'])
  periodType: PeriodType;

  @ApiPropertyOptional({
    description: 'Max number of periods to return, most recent first.',
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

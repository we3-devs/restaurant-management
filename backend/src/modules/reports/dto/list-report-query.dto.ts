import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  outletId?: number;

  @ApiPropertyOptional({ description: 'Defaults to 30 days ago' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'For sales-items: show only customer-credit sales when true' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  credited?: boolean;

  @ApiPropertyOptional({ description: 'ASC or DESC, defaults to DESC' })
  @IsOptional()
  @IsString()
  sortDir?: 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description: 'Export endpoint only: csv, xlsx, or pdf',
  })
  @IsOptional()
  @IsString()
  format?: string;
}

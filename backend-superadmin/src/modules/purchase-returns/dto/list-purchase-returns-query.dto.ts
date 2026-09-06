import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const PR_STATUSES = ['draft', 'processed', 'cancelled'] as const;

export class ListPurchaseReturnsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: PR_STATUSES }) @IsOptional() @IsIn(PR_STATUSES) status?: (typeof PR_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() supplierId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() outletId?: number;
}

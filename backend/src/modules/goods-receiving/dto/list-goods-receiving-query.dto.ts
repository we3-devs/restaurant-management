import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const GRN_STATUSES = ['draft', 'received', 'cancelled'] as const;

export class ListGoodsReceivingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: GRN_STATUSES }) @IsOptional() @IsIn(GRN_STATUSES) status?: (typeof GRN_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() purchaseOrderId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() outletId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() warehouseId?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const PO_STATUSES = ['draft', 'pending_approval', 'approved', 'partially_received', 'received', 'completed', 'cancelled'] as const;

export class ListPurchaseOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: PO_STATUSES }) @IsOptional() @IsIn(PO_STATUSES) status?: (typeof PO_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() supplierId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() outletId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() warehouseId?: number;
}

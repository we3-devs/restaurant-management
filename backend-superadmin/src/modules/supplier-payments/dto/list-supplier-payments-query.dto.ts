import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListSupplierPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() supplierId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() outletId?: number;
  @ApiPropertyOptional({ enum: ['cash', 'bank', 'digital'] }) @IsOptional() @IsIn(['cash', 'bank', 'digital']) paymentMethod?: 'cash' | 'bank' | 'digital';
}

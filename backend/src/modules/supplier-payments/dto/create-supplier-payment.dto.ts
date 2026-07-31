import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class CreateSupplierPaymentDto {
  @ApiProperty() @Type(() => Number) @IsInt() supplierId: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() purchaseOrderId?: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
  @ApiProperty() @IsISO8601({ strict: true }) paymentDate: string;
  @ApiProperty() @Type(() => Number) @Min(0) amount: number;
  @ApiProperty({ enum: ['cash', 'bank', 'digital'] }) @IsIn(['cash', 'bank', 'digital']) paymentMethod: 'cash' | 'bank' | 'digital';
  @ApiPropertyOptional() @IsOptional() @IsString() referenceNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ enum: ['completed', 'pending'] }) @IsOptional() @IsIn(['completed', 'pending']) status?: 'completed' | 'pending';
}

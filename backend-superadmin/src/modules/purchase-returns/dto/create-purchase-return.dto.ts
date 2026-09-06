import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreatePurchaseReturnItemDto {
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() purchaseOrderItemId?: number;
  @ApiProperty() @Type(() => Number) @IsInt() ingredientId: number;
  @ApiProperty() @Type(() => Number) @Min(0) quantity: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) unitCost?: number;
}

export class CreatePurchaseReturnDto {
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() purchaseOrderId?: number;
  @ApiProperty() @Type(() => Number) @IsInt() supplierId: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
  @ApiProperty() @Type(() => Number) @IsInt() warehouseId: number;
  @ApiProperty() @IsISO8601({ strict: true }) returnDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional({ enum: ['refund', 'replacement', 'both'] }) @IsOptional() @IsIn(['refund', 'replacement', 'both']) refundType?: 'refund' | 'replacement' | 'both';
  @ApiPropertyOptional({ type: [CreatePurchaseReturnItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreatePurchaseReturnItemDto)
  items?: CreatePurchaseReturnItemDto[];
}

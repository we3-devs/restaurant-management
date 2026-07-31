import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateGoodsReceivingItemDto {
  @ApiProperty() @Type(() => Number) @IsInt() purchaseOrderItemId: number;
  @ApiProperty() @Type(() => Number) @IsInt() ingredientId: number;
  @ApiProperty() @Type(() => Number) @Min(0) quantityReceived: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() batchNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) expiryDate?: string;
}

export class CreateGoodsReceivingDto {
  @ApiProperty() @Type(() => Number) @IsInt() purchaseOrderId: number;
  @ApiProperty() @Type(() => Number) @IsInt() supplierId: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
  @ApiProperty() @Type(() => Number) @IsInt() warehouseId: number;
  @ApiProperty() @IsISO8601({ strict: true }) receivedDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ type: [CreateGoodsReceivingItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateGoodsReceivingItemDto)
  items?: CreateGoodsReceivingItemDto[];
}

export class AddGoodsReceivingItemDto {
  @ApiProperty() @Type(() => Number) @IsInt() purchaseOrderItemId: number;
  @ApiProperty() @Type(() => Number) @IsInt() ingredientId: number;
  @ApiProperty() @Type(() => Number) @Min(0) quantityReceived: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() batchNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) expiryDate?: string;
}

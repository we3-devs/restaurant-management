import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @ApiProperty() @Type(() => Number) @IsInt() ingredientId: number;
  @ApiProperty() @Type(() => Number) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() unitCost?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() discount?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() tax?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty() @Type(() => Number) @IsInt() supplierId: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
  @ApiProperty() @Type(() => Number) @IsInt() warehouseId: number;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) expectedDeliveryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() discountAmount?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() taxAmount?: number;
  @ApiPropertyOptional({ type: [CreatePurchaseOrderItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) expectedDeliveryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() discountAmount?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() taxAmount?: number;
}

export class AddPurchaseOrderItemDto {
  @ApiProperty() @Type(() => Number) @IsInt() ingredientId: number;
  @ApiProperty() @Type(() => Number) @Min(0) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) discount?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) tax?: number;
}

export class UpdatePurchaseOrderItemDto {
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) discount?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @Min(0) tax?: number;
}

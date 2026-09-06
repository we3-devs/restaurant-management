import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { OrderItemPackagingType } from '../entities/order-item.entity';

const ORDER_ITEM_PACKAGING_TYPES: OrderItemPackagingType[] = [
  'plating',
  'takeaway',
];

export class CreateOrderItemDto {
  @ApiProperty()
  @IsInt()
  foodId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  foodVariantId?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    enum: ORDER_ITEM_PACKAGING_TYPES,
    default: 'plating',
    description: 'Dine-in ("plating") vs takeaway — settable per item so one order can mix both.',
  })
  @IsOptional()
  @IsIn(ORDER_ITEM_PACKAGING_TYPES)
  packagingType?: OrderItemPackagingType;
}

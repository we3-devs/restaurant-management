import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, ValidateNested } from 'class-validator';

export class FoodInventoryTrackingDto {
  @ApiProperty()
  @IsInt()
  foodId: number;

  @ApiProperty({
    description:
      'true: every tracked food item shares one stock item (e.g. Beer). false: each tracked food item has its own (e.g. Coke 1L / Coke 1.5L).',
  })
  @IsBoolean()
  shareStock: boolean;

  @ApiProperty({
    type: [Number],
    description: "The food's active food items to track. Every other active food item of the food stops being tracked.",
  })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  trackedFoodVariantIds: number[];
}

export class SetInventoryTrackingDto {
  @ApiProperty({ type: [FoodInventoryTrackingDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodInventoryTrackingDto)
  foods: FoodInventoryTrackingDto[];

  @ApiProperty({ description: 'Outlet any newly created stock items belong to' })
  @IsInt()
  outletId: number;

  @ApiPropertyOptional({ description: 'Stock-tracked category for newly created stock items' })
  @IsOptional()
  @IsInt()
  ingredientCategoryId?: number;

  @ApiPropertyOptional({ description: 'Counting unit for newly created stock items' })
  @IsOptional()
  @IsInt()
  baseUnitId?: number;
}

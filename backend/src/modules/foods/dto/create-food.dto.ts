import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { FoodItemType, FoodType } from '../entities/food.entity';
import {
  OUTLET_DEPARTMENT_TYPES,
  type OutletDepartmentType,
} from '../../outlet-departments/entities/outlet-department.entity';

const FOOD_TYPES: FoodType[] = ['veg', 'non_veg', 'egg', 'vegan'];
const FOOD_ITEM_TYPES: FoodItemType[] = ['food', 'beverage', 'combo'];

export class CreateFoodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  foodCategoryId?: number;

  @ApiProperty({ example: 'Margherita Pizza' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'margherita-pizza' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, alphanumeric, hyphen-separated',
  })
  @MaxLength(255)
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      "This item's SKU segment, e.g. MOMO. Set it and `sku` is composed for this food and every variant under it.",
    example: 'MOMO',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  skuSegment?: string;

  @ApiPropertyOptional({ description: 'Photo of the dish, from POST /uploads/food' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: FOOD_TYPES })
  @IsOptional()
  @IsIn(FOOD_TYPES)
  foodType?: FoodType;

  @ApiPropertyOptional({ enum: FOOD_ITEM_TYPES, default: 'food' })
  @IsOptional()
  @IsIn(FOOD_ITEM_TYPES)
  itemType?: FoodItemType = 'food';

  @ApiPropertyOptional({
    enum: OUTLET_DEPARTMENT_TYPES,
    description:
      'Department that prepares this item; omit for ready-made items needing no kitchen prep. Orders resolve this to the matching department at the order\'s outlet automatically.',
  })
  @IsOptional()
  @IsIn(OUTLET_DEPARTMENT_TYPES)
  departmentType?: OutletDepartmentType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isDiscountable?: boolean = true;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @ApiPropertyOptional({
    default: false,
    description:
      'Gates whether Orders resolves food_recipes and reserves ingredient stock for this food.',
  })
  @IsOptional()
  @IsBoolean()
  isRecipeEnabled?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  preparationTime?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number = 0;
}

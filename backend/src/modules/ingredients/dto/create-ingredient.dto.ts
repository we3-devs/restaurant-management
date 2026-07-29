import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const INGREDIENT_TYPES = [
  'raw_material',
  'ready_product',
  'packaging',
  'consumable',
] as const;

const COSTING_METHODS = [
  'fifo',
  'lifo',
  'weighted_average',
  'moving_average',
  'specific_identification',
] as const;

export class CreateIngredientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  ingredientCategoryId?: number;

  @ApiProperty({ example: 'Chicken Breast' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'chicken-breast' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, alphanumeric, hyphen-separated',
  })
  @MaxLength(255)
  slug: string;

  @ApiProperty({ example: 'ING-0001' })
  @IsString()
  @MaxLength(80)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  @ApiPropertyOptional({ enum: INGREDIENT_TYPES, default: 'raw_material' })
  @IsOptional()
  @IsIn(INGREDIENT_TYPES)
  type?: (typeof INGREDIENT_TYPES)[number] = 'raw_material';

  @ApiProperty({ description: 'The smallest/main stock calculation unit' })
  @IsInt()
  baseUnitId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  defaultPurchaseUnitId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  defaultUsageUnitId?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderQuantity?: number = 0;

  @ApiPropertyOptional({
    enum: COSTING_METHODS,
    default: 'fifo',
    description:
      'Mapped for future batch-level costing; ignored by Phase 6 weighted-average movement math.',
  })
  @IsOptional()
  @IsIn(COSTING_METHODS)
  costingMethod?: (typeof COSTING_METHODS)[number] = 'fifo';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPerishable?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFoodVariantDto {
  @ApiProperty()
  @IsInt()
  foodId: number;

  @ApiPropertyOptional({
    description:
      'Parent variant id for a two-level menu, e.g. Half/Full nested under Veg. Omit for a top-level variant.',
  })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ example: 'Large' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sku?: string;

  @ApiPropertyOptional({
    description:
      "This level's SKU segment, e.g. CHI or FULL. Composed onto the food's segment and any parent variant's, giving MOMO-CHI-FULL.",
    example: 'CHI',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  skuSegment?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number = 0;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number = 0;
}

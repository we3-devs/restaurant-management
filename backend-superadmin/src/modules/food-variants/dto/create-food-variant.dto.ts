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
      'Variant from the global list, e.g. Chicken. Omit for a plain item with no variant.',
  })
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiPropertyOptional({
    description:
      'Sub-variant from the global list, e.g. Full. Omit for an item with no size.',
  })
  @IsOptional()
  @IsInt()
  subVariantId?: number;

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

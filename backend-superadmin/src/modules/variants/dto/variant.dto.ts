import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({ example: 'Chicken' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'CHI',
    description: 'Piece of the composed SKU, e.g. CHI in CHOWMIN-CHI-FULL.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  skuSegment?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number = 0;
}

export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

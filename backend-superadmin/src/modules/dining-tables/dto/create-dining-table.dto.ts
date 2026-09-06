import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { DiningTableShape } from '../entities/dining-table.entity';

const DINING_TABLE_SHAPES: DiningTableShape[] = [
  'rectangle',
  'square',
  'circle',
  'oval',
];

export class CreateDiningTableDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiProperty()
  @IsInt()
  diningAreaId: number;

  @ApiProperty({ example: 'T1' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  // Normalized so it always matches the guest QR page's forced
  // .toUpperCase() lookup (findByCode does an exact-match query) — without
  // this, a table created with a lowercase/mixed-case code would never be
  // findable by guests scanning its QR card.
  @ApiPropertyOptional({ example: 'T1' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  code?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number = 1;

  @ApiPropertyOptional({ enum: DINING_TABLE_SHAPES, default: 'rectangle' })
  @IsOptional()
  @IsIn(DINING_TABLE_SHAPES)
  shape?: DiningTableShape = 'rectangle';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  positionX?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  positionY?: number = 0;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  sortOrder?: number = 100;
}

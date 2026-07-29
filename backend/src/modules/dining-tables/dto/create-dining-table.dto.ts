import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
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

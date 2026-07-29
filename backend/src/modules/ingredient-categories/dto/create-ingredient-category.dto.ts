import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateIngredientCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ example: 'Vegetables' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'vegetables' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, alphanumeric, hyphen-separated',
  })
  @MaxLength(255)
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;
}

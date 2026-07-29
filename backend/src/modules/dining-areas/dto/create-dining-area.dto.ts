import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDiningAreaDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiProperty({ example: 'Main Hall' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'MAIN' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  layoutWidth?: number = 1000;

  @ApiPropertyOptional({ default: 700 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  layoutHeight?: number = 700;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  sortOrder?: number = 100;
}

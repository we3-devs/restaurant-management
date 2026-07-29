import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const UNIT_TYPES = ['weight', 'volume', 'quantity', 'custom'] as const;

export class CreateUnitDto {
  @ApiProperty({ example: 'Kilogram' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'kg' })
  @IsString()
  @MaxLength(20)
  shortName: string;

  @ApiPropertyOptional({ enum: UNIT_TYPES, default: 'quantity' })
  @IsOptional()
  @IsIn(UNIT_TYPES)
  type?: (typeof UNIT_TYPES)[number] = 'quantity';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isBase?: boolean = false;
}

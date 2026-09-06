import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  outletDepartmentId?: number;

  @ApiProperty({ example: 'Main Store' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'WH-01' })
  @IsString()
  @MaxLength(80)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}

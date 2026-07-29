import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { OutletDepartmentType } from '../entities/outlet-department.entity';

const OUTLET_DEPARTMENT_TYPES: OutletDepartmentType[] = [
  'kitchen',
  'bar',
  'counter',
  'store',
  'bakery',
  'housekeeping',
  'other',
];

export class CreateOutletDepartmentDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiProperty({ example: 'Main Kitchen' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'KIT-01' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @ApiPropertyOptional({ enum: OUTLET_DEPARTMENT_TYPES, default: 'other' })
  @IsOptional()
  @IsIn(OUTLET_DEPARTMENT_TYPES)
  type?: OutletDepartmentType = 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canPrepareOrder?: boolean = false;
}

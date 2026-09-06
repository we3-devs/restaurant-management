import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { CreateFoodDto } from './create-food.dto';
import {
  OUTLET_DEPARTMENT_TYPES,
  type OutletDepartmentType,
} from '../../outlet-departments/entities/outlet-department.entity';

// slug is immutable after creation — omitted entirely, not just optional.
// departmentType is redeclared below (nullable, to support clearing it back
// to "ready-made") instead of inheriting CreateFoodDto's non-nullable one.
export class UpdateFoodDto extends PartialType(
  OmitType(CreateFoodDto, ['slug', 'departmentType'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: OUTLET_DEPARTMENT_TYPES, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(OUTLET_DEPARTMENT_TYPES)
  departmentType?: OutletDepartmentType | null;
}

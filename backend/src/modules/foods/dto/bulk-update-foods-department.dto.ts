import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, ValidateIf } from 'class-validator';
import {
  OUTLET_DEPARTMENT_TYPES,
  type OutletDepartmentType,
} from '../../outlet-departments/entities/outlet-department.entity';

export class BulkUpdateFoodsDepartmentDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  ids: number[];

  // null clears departmentType back to "ready-made, no kitchen prep needed".
  @ApiProperty({ enum: OUTLET_DEPARTMENT_TYPES, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsIn(OUTLET_DEPARTMENT_TYPES)
  departmentType: OutletDepartmentType | null;
}

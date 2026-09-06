import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AssignDepartmentDto {
  @ApiProperty({ example: 4 })
  @IsInt() @Min(1)
  departmentId: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt } from 'class-validator';

export class AssignShiftDto {
  @ApiProperty() @Type(() => Number) @IsInt() shiftId: number;
  @ApiProperty() @Type(() => Number) @IsInt() employeeId: number;
  @ApiProperty({ example: '2026-07-29' }) @IsDateString() assignedDate: string;
}

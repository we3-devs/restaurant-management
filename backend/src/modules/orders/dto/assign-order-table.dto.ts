import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import type { OrderTableAssignmentType } from '../entities/order-table.entity';

const ASSIGNMENT_TYPES: OrderTableAssignmentType[] = [
  'reserved_copy',
  'added_on_arrival',
  'changed_by_staff',
];

export class AssignOrderTableDto {
  @ApiProperty()
  @IsInt()
  diningTableId: number;

  @ApiPropertyOptional({ enum: ASSIGNMENT_TYPES, default: 'added_on_arrival' })
  @IsOptional()
  @IsIn(ASSIGNMENT_TYPES)
  assignmentType?: OrderTableAssignmentType = 'added_on_arrival';
}

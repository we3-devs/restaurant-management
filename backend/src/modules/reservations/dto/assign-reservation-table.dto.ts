import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignReservationTableDto {
  @ApiProperty()
  @IsInt()
  diningTableId: number;
}

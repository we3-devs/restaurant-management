import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class TransferTableSessionDto {
  @ApiProperty()
  @IsInt()
  newDiningTableId: number;
}

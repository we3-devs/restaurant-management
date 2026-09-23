import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateKitPortionDto {
  @ApiProperty({ example: 'Quarter Peg' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Unit the quantity is expressed in (typically the kit item’s own unit)' })
  @IsInt()
  unitId: number;

  @ApiProperty({ example: 0.25, description: 'Fraction of one kit-item unit this portion consumes' })
  @IsNumber()
  @IsPositive()
  quantity: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateIngredientVariantPortionDto {
  @ApiProperty({ example: 'Quarter Peg' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Unit the quantity is expressed in (typically the variant’s own unit)' })
  @IsInt()
  unitId: number;

  @ApiProperty({ example: 0.25, description: 'Fraction of one variant unit this portion consumes' })
  @IsNumber()
  @IsPositive()
  quantity: number;
}

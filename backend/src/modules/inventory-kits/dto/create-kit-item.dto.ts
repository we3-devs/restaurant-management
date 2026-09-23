import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateKitItemDto {
  @ApiProperty({ description: 'The Ingredient this variance draws stock from' })
  @IsInt()
  ingredientId: number;

  @ApiProperty({ example: '250ml' })
  @IsString()
  @MaxLength(100)
  label: string;

  @ApiProperty({ description: 'Unit the label/quantity is expressed in' })
  @IsInt()
  unitId: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;
}

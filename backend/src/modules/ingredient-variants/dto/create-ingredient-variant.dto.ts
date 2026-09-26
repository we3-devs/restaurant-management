import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateIngredientVariantDto {
  @ApiProperty({ description: 'The Ingredient this variant draws its own stock from' })
  @IsInt()
  ingredientId: number;

  @ApiProperty({ example: '250ml' })
  @IsString()
  @MaxLength(100)
  label: string;

  @ApiProperty({ description: 'Unit the label/quantity is expressed in' })
  @IsInt()
  unitId: number;

  @ApiPropertyOptional({
    description: 'Bottles/units per purchase package (e.g. 24 bottles per carton), if bought that way',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerPackage?: number;

  @ApiPropertyOptional({ example: 'Carton' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  packageLabel?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;
}

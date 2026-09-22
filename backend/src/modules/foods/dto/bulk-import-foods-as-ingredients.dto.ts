import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class BulkImportFoodsAsIngredientsDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  foodIds: number[];

  @ApiProperty({ description: 'Outlet the new ingredients belong to' })
  @IsInt()
  outletId: number;

  @ApiProperty({ description: "Determines the new ingredients' type/trackability" })
  @IsInt()
  ingredientCategoryId: number;

  @ApiProperty({ description: 'The smallest/main stock calculation unit for the new ingredients' })
  @IsInt()
  baseUnitId: number;
}

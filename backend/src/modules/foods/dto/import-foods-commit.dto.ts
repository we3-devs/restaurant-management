import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateFoodDto } from './create-food.dto';

export class ImportFoodsCommitDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFoodDto)
  rows: CreateFoodDto[];
}

import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateIngredientWastageDto } from './create-ingredient-wastage.dto';

// warehouseId is immutable after creation.
export class UpdateIngredientWastageDto extends PartialType(
  OmitType(CreateIngredientWastageDto, ['warehouseId'] as const),
) {}

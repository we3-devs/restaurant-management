import { PartialType } from '@nestjs/swagger';
import { CreateIngredientWastageItemDto } from './create-ingredient-wastage-item.dto';

// ingredientId is immutable — remove the item and add a new one instead.
export class UpdateIngredientWastageItemDto extends PartialType(
  CreateIngredientWastageItemDto,
) {}

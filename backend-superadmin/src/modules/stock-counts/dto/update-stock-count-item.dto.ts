import { PartialType } from '@nestjs/swagger';
import { CreateStockCountItemDto } from './create-stock-count-item.dto';

// ingredientId is immutable — remove the item and add a new one instead.
export class UpdateStockCountItemDto extends PartialType(
  CreateStockCountItemDto,
) {}

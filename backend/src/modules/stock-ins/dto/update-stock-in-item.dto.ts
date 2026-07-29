import { PartialType } from '@nestjs/swagger';
import { CreateStockInItemDto } from './create-stock-in-item.dto';

// ingredientId is immutable — remove the item and add a new one instead.
export class UpdateStockInItemDto extends PartialType(CreateStockInItemDto) {}

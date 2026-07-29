import { PartialType } from '@nestjs/swagger';
import { CreateStockOutItemDto } from './create-stock-out-item.dto';

// ingredientId is immutable — remove the item and add a new one instead.
export class UpdateStockOutItemDto extends PartialType(CreateStockOutItemDto) {}

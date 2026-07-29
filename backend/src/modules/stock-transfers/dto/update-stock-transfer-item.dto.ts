import { PartialType } from '@nestjs/swagger';
import { CreateStockTransferItemDto } from './create-stock-transfer-item.dto';

// ingredientId is immutable — remove the item and add a new one instead.
export class UpdateStockTransferItemDto extends PartialType(
  CreateStockTransferItemDto,
) {}

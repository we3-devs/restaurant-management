import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStockCountDto } from './create-stock-count.dto';

// warehouseId is immutable after creation.
export class UpdateStockCountDto extends PartialType(
  OmitType(CreateStockCountDto, ['warehouseId'] as const),
) {}

import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStockAdjustmentDto } from './create-stock-adjustment.dto';

// warehouseId is immutable after creation.
export class UpdateStockAdjustmentDto extends PartialType(
  OmitType(CreateStockAdjustmentDto, ['warehouseId'] as const),
) {}

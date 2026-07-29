import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStockTransferDto } from './create-stock-transfer.dto';

// fromWarehouseId/toWarehouseId are immutable after creation.
export class UpdateStockTransferDto extends PartialType(
  OmitType(CreateStockTransferDto, [
    'fromWarehouseId',
    'toWarehouseId',
  ] as const),
) {}

import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStockInDto } from './create-stock-in.dto';

// warehouseId is immutable after creation.
export class UpdateStockInDto extends PartialType(
  OmitType(CreateStockInDto, ['warehouseId'] as const),
) {}

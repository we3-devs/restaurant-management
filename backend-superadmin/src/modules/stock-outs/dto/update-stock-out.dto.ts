import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStockOutDto } from './create-stock-out.dto';

// warehouseId is immutable after creation.
export class UpdateStockOutDto extends PartialType(
  OmitType(CreateStockOutDto, ['warehouseId'] as const),
) {}

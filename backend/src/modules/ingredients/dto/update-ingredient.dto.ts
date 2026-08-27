import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateIngredientDto } from './create-ingredient.dto';

// baseUnitId and outletId are immutable after creation — omitted entirely, not just optional.
export class UpdateIngredientDto extends PartialType(
  OmitType(CreateIngredientDto, ['baseUnitId', 'outletId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

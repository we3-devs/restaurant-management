import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateIngredientDto } from './create-ingredient.dto';

// baseUnitId is immutable after creation — omitted entirely, not just optional.
export class UpdateIngredientDto extends PartialType(
  OmitType(CreateIngredientDto, ['baseUnitId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateFoodVariantDto } from './create-food-variant.dto';

// foodId is immutable after creation — omitted entirely, not just optional.
export class UpdateFoodVariantDto extends PartialType(
  OmitType(CreateFoodVariantDto, ['foodId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

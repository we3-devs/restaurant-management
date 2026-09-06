import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateFoodCategoryDto } from './create-food-category.dto';

// slug is immutable after creation — omitted entirely, not just optional.
export class UpdateFoodCategoryDto extends PartialType(
  OmitType(CreateFoodCategoryDto, ['slug'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

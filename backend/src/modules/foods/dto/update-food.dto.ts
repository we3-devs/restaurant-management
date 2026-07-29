import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateFoodDto } from './create-food.dto';

// slug is immutable after creation — omitted entirely, not just optional.
export class UpdateFoodDto extends PartialType(
  OmitType(CreateFoodDto, ['slug'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

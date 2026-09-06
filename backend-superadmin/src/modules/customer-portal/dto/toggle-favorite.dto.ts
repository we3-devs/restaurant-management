import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class ToggleFavoriteDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  foodId: number;
}

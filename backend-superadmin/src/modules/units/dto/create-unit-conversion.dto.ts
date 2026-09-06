import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreateUnitConversionDto {
  @ApiProperty()
  @IsInt()
  toUnitId: number;

  @ApiProperty({
    description:
      'from-unit quantity × multiplier = to-unit quantity. The reverse conversion (to-unit → from-unit) is created/updated automatically with multiplier 1/multiplier.',
  })
  @IsNumber()
  @IsPositive()
  multiplier: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  isActive?: boolean = true;
}

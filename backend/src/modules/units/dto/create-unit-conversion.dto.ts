import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateUnitConversionDto {
  @ApiProperty()
  @IsInt()
  toUnitId: number;

  @ApiProperty({
    description: 'from-unit quantity × multiplier = to-unit quantity',
  })
  @IsNumber()
  @Min(0)
  multiplier: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  isActive?: boolean = true;
}

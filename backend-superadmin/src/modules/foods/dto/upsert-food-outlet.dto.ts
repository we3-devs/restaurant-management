import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpsertFoodOutletDto {
  @ApiProperty()
  @IsInt()
  outletId: number;

  @ApiPropertyOptional({
    description: 'Overrides the food base price at this outlet',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;
}

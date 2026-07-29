import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty()
  @IsInt()
  foodId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  foodVariantId?: number;

  @ApiProperty({
    description:
      'Which outlet department (kitchen/bar/etc.) prepares this item',
  })
  @IsInt()
  preparationDepartmentId: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

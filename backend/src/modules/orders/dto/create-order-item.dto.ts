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

  @ApiPropertyOptional({
    description:
      'Which outlet department (kitchen/bar/etc.) prepares this item — omit for items that need no prep routing (e.g. bottled drinks)',
  })
  @IsOptional()
  @IsInt()
  preparationDepartmentId?: number;

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

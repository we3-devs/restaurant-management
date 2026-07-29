import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockTransferItemDto {
  @ApiProperty()
  @IsInt()
  ingredientId: number;

  @ApiProperty({
    description:
      "Cost is not entered here — it is priced at the source warehouse's current weighted-average cost when the transfer is approved.",
  })
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

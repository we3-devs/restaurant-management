import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateStockOutItemDto {
  @ApiProperty()
  @IsInt()
  ingredientId: number;

  @ApiProperty({
    description:
      "Cost is not entered here — it is priced at the warehouse's current weighted-average cost when the stock-out is approved.",
  })
  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

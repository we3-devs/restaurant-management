import { ApiProperty } from '@nestjs/swagger';

export class FoodOutletResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  foodId: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty({ required: false, nullable: true })
  price: number | null;

  @ApiProperty()
  isAvailable: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

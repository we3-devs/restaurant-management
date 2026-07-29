import { ApiProperty } from '@nestjs/swagger';

export class FoodVariantResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  foodId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  sku: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

import { ApiProperty } from '@nestjs/swagger';

export class FoodCategoryResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ required: false, nullable: true })
  parentId: number | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty({ required: false, nullable: true })
  image: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

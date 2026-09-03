import { ApiProperty } from '@nestjs/swagger';
import type {
  FoodItemType,
  FoodType,
} from '../entities/food.entity';
import type { OutletDepartmentType } from '../../outlet-departments/entities/outlet-department.entity';

export class FoodResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ required: false, nullable: true })
  foodCategoryId: number | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false, nullable: true })
  sku: string | null;

  @ApiProperty({ required: false, nullable: true })
  skuSegment: string | null;

  @ApiProperty({ required: false, nullable: true })
  imageUrl: string | null;

  @ApiProperty({ required: false, nullable: true })
  shortDescription: string | null;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty({ required: false, nullable: true })
  foodType: FoodType | null;

  @ApiProperty()
  itemType: FoodItemType;

  @ApiProperty({ required: false, nullable: true })
  departmentType: OutletDepartmentType | null;

  @ApiProperty()
  basePrice: number;

  @ApiProperty()
  hasVariants: boolean;

  @ApiProperty()
  hasAddons: boolean;

  @ApiProperty()
  isTaxable: boolean;

  @ApiProperty()
  isDiscountable: boolean;

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  preparationTime: number | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

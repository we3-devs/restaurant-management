import type { FoodItemType, FoodType } from '../entities/food.entity';
import type { OutletDepartmentType } from '../../outlet-departments/entities/outlet-department.entity';

/** One previewed row from an uploaded CSV/Excel file — parsed and validated, but not yet saved. */
export interface ImportFoodRow {
  rowNumber: number;
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  foodCategoryName: string | null;
  foodCategoryId: number | null;
  itemType: FoodItemType;
  departmentType: OutletDepartmentType | null;
  foodType: FoodType | null;
  basePrice: number;
  errors: string[];
}

export interface ImportFoodsPreviewResult {
  rows: ImportFoodRow[];
  validCount: number;
  invalidCount: number;
}

export interface ImportFoodsCommitResult {
  createdCount: number;
  failedCount: number;
  failures: { index: number; name: string; error: string }[];
}

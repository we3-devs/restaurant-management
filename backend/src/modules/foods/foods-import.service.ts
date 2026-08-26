import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoodCategoriesService } from '../food-categories/food-categories.service';
import {
  OUTLET_DEPARTMENT_TYPES,
  type OutletDepartmentType,
} from '../outlet-departments/entities/outlet-department.entity';
import { CreateFoodDto } from './dto/create-food.dto';
import type {
  ImportFoodRow,
  ImportFoodsCommitResult,
  ImportFoodsPreviewResult,
} from './dto/import-food-row.dto';
import type { FoodItemType, FoodType } from './entities/food.entity';
import { Food } from './entities/food.entity';
import { parseFoodsImportFile } from './import/foods-import.util';
import { FoodsService } from './foods.service';

const FOOD_TYPES: FoodType[] = ['veg', 'non_veg', 'egg', 'vegan'];
const FOOD_ITEM_TYPES: FoodItemType[] = ['food', 'beverage', 'combo'];

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class FoodsImportService {
  constructor(
    @InjectRepository(Food)
    private readonly foodsRepository: Repository<Food>,
    private readonly foodCategoriesService: FoodCategoriesService,
    private readonly foodsService: FoodsService,
  ) {}

  async previewImport(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<ImportFoodsPreviewResult> {
    const rawRows = await parseFoodsImportFile(buffer, mimetype, originalname);
    return this.validateRows(rawRows);
  }

  /**
   * Re-runs the same validation used at file-parse time against rows the
   * user has since hand-edited in the preview table — same signature as
   * previewImport's output, so the frontend can just swap the row list in
   * place. Needed because uniqueness (slug/sku) and category-name resolution
   * depend on DB state and on the other rows in the batch, not just the one
   * field someone just typed into.
   */
  async revalidateRows(rawRows: Record<string, string>[]): Promise<ImportFoodsPreviewResult> {
    return this.validateRows(rawRows);
  }

  private async validateRows(rawRows: Record<string, string>[]): Promise<ImportFoodsPreviewResult> {
    const [existingFoods, categoriesPage] = await Promise.all([
      this.foodsRepository.find({ select: { slug: true, sku: true } }),
      this.foodCategoriesService.findAll({ page: 1, limit: 500 }),
    ]);
    const existingSlugs = new Set(existingFoods.map((f) => f.slug));
    const existingSkus = new Set(
      existingFoods.map((f) => f.sku).filter((sku): sku is string => !!sku),
    );
    const categoryByName = new Map(
      categoriesPage.data.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );

    const seenSlugs = new Set<string>();
    const seenSkus = new Set<string>();

    const rows: ImportFoodRow[] = rawRows.map((raw, index) => {
      const errors: string[] = [];
      const rowNumber = index + 2; // header is row 1

      const name = raw.name?.trim() ?? '';
      if (!name || name.length < 2) {
        errors.push('Name is required (min 2 characters)');
      }

      let slug = raw.slug?.trim().toLowerCase() ?? '';
      if (!slug) slug = slugify(name);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        errors.push('Slug must be lowercase, alphanumeric, hyphen-separated');
      } else if (existingSlugs.has(slug) || seenSlugs.has(slug)) {
        errors.push(`Slug "${slug}" is already in use`);
      } else {
        seenSlugs.add(slug);
      }

      const sku = raw.sku?.trim() || null;
      if (sku) {
        if (existingSkus.has(sku) || seenSkus.has(sku)) {
          errors.push(`SKU "${sku}" is already in use`);
        } else {
          seenSkus.add(sku);
        }
      }

      // WooCommerce exports can list a category path/multiple terms
      // ("Drinks > Cold Drinks", "Drinks, Soft Drinks") — only the first is
      // used to resolve an id here.
      const foodCategoryRaw = raw.foodCategory?.split(/[>,|]/)[0]?.trim() || null;
      let foodCategoryId: number | null = null;
      if (foodCategoryRaw) {
        foodCategoryId = categoryByName.get(foodCategoryRaw.toLowerCase()) ?? null;
        // No error when unmatched — category is optional on Food, and most
        // migrated category names won't exist here yet. The row still
        // imports, just without a category assigned.
      }

      const itemTypeRaw = (raw.itemType?.trim().toLowerCase() || 'food') as FoodItemType;
      if (!FOOD_ITEM_TYPES.includes(itemTypeRaw)) {
        errors.push(`Item type must be one of: ${FOOD_ITEM_TYPES.join(', ')}`);
      }

      const departmentTypeRaw = raw.departmentType?.trim().toLowerCase() || null;
      let departmentType: OutletDepartmentType | null = null;
      if (departmentTypeRaw) {
        if (!OUTLET_DEPARTMENT_TYPES.includes(departmentTypeRaw as OutletDepartmentType)) {
          errors.push(`Department type must be one of: ${OUTLET_DEPARTMENT_TYPES.join(', ')}`);
        } else {
          departmentType = departmentTypeRaw as OutletDepartmentType;
        }
      }

      const foodTypeRaw = raw.foodType?.trim().toLowerCase() || null;
      let foodType: FoodType | null = null;
      if (foodTypeRaw) {
        if (!FOOD_TYPES.includes(foodTypeRaw as FoodType)) {
          errors.push(`Food type must be one of: ${FOOD_TYPES.join(', ')}`);
        } else {
          foodType = foodTypeRaw as FoodType;
        }
      }

      const basePriceRaw = raw.basePrice?.trim() ?? '';
      let basePrice = 0;
      if (basePriceRaw !== '') {
        basePrice = Number(basePriceRaw);
        if (Number.isNaN(basePrice) || basePrice < 0) {
          errors.push('Base price must be a non-negative number');
        }
      }

      return {
        rowNumber,
        name,
        slug,
        sku,
        shortDescription: raw.shortDescription?.trim() || null,
        imageUrl: raw.imageUrl?.trim() || null,
        foodCategoryName: foodCategoryRaw,
        foodCategoryId,
        itemType: FOOD_ITEM_TYPES.includes(itemTypeRaw) ? itemTypeRaw : 'food',
        departmentType,
        foodType,
        basePrice: Number.isNaN(basePrice) ? 0 : basePrice,
        errors,
      };
    });

    const invalidCount = rows.filter((r) => r.errors.length > 0).length;
    return { rows, validCount: rows.length - invalidCount, invalidCount };
  }

  async commitImport(rows: CreateFoodDto[]): Promise<ImportFoodsCommitResult> {
    const failures: ImportFoodsCommitResult['failures'] = [];
    let createdCount = 0;

    for (const [index, row] of rows.entries()) {
      try {
        await this.foodsService.create(row);
        createdCount += 1;
      } catch (error) {
        failures.push({
          index,
          name: row.name,
          error: error instanceof Error ? error.message : 'Failed to create food',
        });
      }
    }

    return { createdCount, failedCount: failures.length, failures };
  }
}

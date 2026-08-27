import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { FoodCategory } from '../../food-categories/entities/food-category.entity';
import {
  OUTLET_DEPARTMENT_TYPES,
  type OutletDepartmentType,
} from '../../outlet-departments/entities/outlet-department.entity';
import type { FoodItemType, FoodType } from '../entities/food.entity';
import { Food } from '../entities/food.entity';
import { SkuCompositionService } from '../sku-composition.service';

const FOOD_TYPES: FoodType[] = ['veg', 'non_veg', 'egg', 'vegan'];
const FOOD_ITEM_TYPES: FoodItemType[] = ['food', 'beverage', 'combo'];

/**
 * Header aliases -> the logical column key. Covers both a plain
 * "name,slug,sku,basePrice,..." sheet and a WordPress/WooCommerce post
 * export ("post_title", "post_name", "regular_price", "tax:product_cat",
 * ...), since that's what most menu migrations bring in. postStatus/
 * postParent aren't Food fields — they're read only by rowFilter, to drop
 * trashed posts and WooCommerce variation child rows. Unchanged from the
 * pre-migration foods-import.util.ts's HEADER_ALIASES.
 */
const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  posttitle: 'name',
  slug: 'slug',
  postname: 'slug',
  sku: 'sku',
  shortdescription: 'shortDescription',
  description: 'shortDescription',
  postexcerpt: 'shortDescription',
  category: 'foodCategory',
  foodcategory: 'foodCategory',
  categories: 'foodCategory',
  taxproductcat: 'foodCategory',
  itemtype: 'itemType',
  departmenttype: 'departmentType',
  department: 'departmentType',
  foodtype: 'foodType',
  price: 'basePrice',
  baseprice: 'basePrice',
  regularprice: 'basePrice',
  images: 'imageUrl',
  image: 'imageUrl',
  poststatus: 'postStatus',
  postparent: 'postParent',
};

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function firstImageUrl(raw: string): string {
  return raw.split(/[|,\s]+/)[0] ?? '';
}

interface FoodImportRow extends ImportValidatedRow {
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  foodCategory: string | null;
  foodCategoryId: number | null;
  itemType: FoodItemType;
  departmentType: OutletDepartmentType | null;
  foodType: FoodType | null;
  basePrice: number;
}

/**
 * Foods — identity: slug (and sku, if given). Create only, same as the
 * pre-migration Foods importer this replaces: a row whose slug or sku
 * collides with an existing food is a validation error, not an update
 * (unlike Ingredients/Customers/Suppliers, which upsert — Foods' prior
 * behavior is preserved as-is here rather than retroactively changed).
 * Category is resolved by name but, matching prior behavior, an unmatched
 * category is NOT an error — most legacy category names won't exist yet, so
 * the row still imports without one rather than being rejected.
 */
@Injectable()
export class FoodsImporter implements ImportDomainConfig<Record<string, string>, FoodImportRow> {
  domain = 'foods';
  label = 'Foods';
  mode = 'create' as const;
  identityDescription = 'slug';
  headerAliases = HEADER_ALIASES;
  rowFilter = (raw: Record<string, string>): boolean => {
    // Trashed WP posts and WooCommerce variation rows (child of a variable
    // product) aren't standalone menu items — skip them rather than
    // importing deleted or duplicate-per-variant rows as separate foods.
    if (raw.postStatus?.trim().toLowerCase() === 'trash') return false;
    const postParent = raw.postParent?.trim();
    if (postParent && postParent !== '0') return false;
    return true;
  };

  constructor(
    @InjectRepository(Food)
    private readonly foodsRepository: Repository<Food>,
    @InjectRepository(FoodCategory)
    private readonly foodCategoriesRepository: Repository<FoodCategory>,
    private readonly skuCompositionService: SkuCompositionService,
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<FoodImportRow[]> {
    const [existingFoods, categories] = await Promise.all([
      this.foodsRepository.find({ select: { slug: true, sku: true } }),
      this.foodCategoriesRepository.find({ select: { id: true, name: true } }),
    ]);
    const existingSlugs = new Set(existingFoods.map((f) => f.slug));
    const existingSkus = new Set(existingFoods.map((f) => f.sku).filter((sku): sku is string => !!sku));
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const seenSlugs = new Set<string>();
    const seenSkus = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const errors: string[] = [];

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
      const foodCategoryId = foodCategoryRaw ? (categoryByName.get(foodCategoryRaw.toLowerCase()) ?? null) : null;

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
        imageUrl: raw.imageUrl ? firstImageUrl(raw.imageUrl.trim()) || null : null,
        foodCategory: foodCategoryRaw,
        foodCategoryId,
        itemType: FOOD_ITEM_TYPES.includes(itemTypeRaw) ? itemTypeRaw : 'food',
        departmentType,
        foodType,
        basePrice: Number.isNaN(basePrice) ? 0 : basePrice,
        errors,
      };
    });
  }

  async commitRows(rows: FoodImportRow[], manager: EntityManager): Promise<ImportCommitResult> {
    const repo = manager.getRepository(Food);
    const failures: ImportCommitResult['failures'] = [];
    const succeeded: ImportCommitResult['succeeded'] = [];

    for (const row of rows) {
      try {
        const saved = await repo.save(
          repo.create({
            foodCategoryId: row.foodCategoryId,
            name: row.name,
            slug: row.slug,
            sku: row.sku,
            shortDescription: row.shortDescription,
            imageUrl: row.imageUrl,
            foodType: row.foodType,
            itemType: row.itemType,
            departmentType: row.departmentType,
            basePrice: row.basePrice,
          }),
        );
        // Every food needs a composed SKU even with no segment configured —
        // same transaction as the insert, via the same manager, matching
        // FoodsService.create()'s save+recompose-together guarantee.
        await this.skuCompositionService.recomposeFoodTree(saved.id, manager);
        succeeded.push({ rowNumber: row.rowNumber, entityId: saved.id });
      } catch (error) {
        failures.push({ rowNumber: row.rowNumber, error: error instanceof Error ? error.message : 'Failed to create food' });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Foods');
    sheet.addRow(['name', 'slug', 'sku', 'category', 'itemType', 'basePrice']);
    sheet.addRow(['Margherita Pizza', 'margherita-pizza', 'PIZZA-001', 'Pizza', 'food', '450']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildExport(): Promise<Buffer> {
    const [foods, categories] = await Promise.all([
      this.foodsRepository.find({ order: { id: 'ASC' } }),
      this.foodCategoriesRepository.find({ select: { id: true, name: true } }),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Foods');
    sheet.addRow(['name', 'slug', 'sku', 'category', 'itemType', 'basePrice']);
    for (const food of foods) {
      sheet.addRow([
        food.name,
        food.slug,
        food.sku ?? '',
        food.foodCategoryId ? (categoryById.get(food.foodCategoryId) ?? '') : '',
        food.itemType,
        food.basePrice,
      ]);
    }
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}

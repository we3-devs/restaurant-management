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
const FOOD_ITEM_TYPES: FoodItemType[] = ['kitchen', 'ready_made'];

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

const FOOD_SLUG_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .replace(/--+/g, '-')
    .replace(/\.\.+/g, '.');
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
      if (!FOOD_SLUG_PATTERN.test(slug)) {
        errors.push('Slug must be lowercase, alphanumeric, dot or hyphen-separated');
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

      const itemTypeRaw = (raw.itemType?.trim().toLowerCase() || 'ready_made') as FoodItemType;
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
        itemType: FOOD_ITEM_TYPES.includes(itemTypeRaw) ? itemTypeRaw : 'ready_made',
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
      this.foodCategoriesRepository.find({ order: { sortOrder: 'ASC', name: 'ASC' } }),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const [items, outletPricing, addonRows] = await Promise.all([
      this.foodsRepository.manager
        .createQueryBuilder()
        .select('food.id', 'foodId')
        .addSelect('food.name', 'foodName')
        .addSelect('food.slug', 'foodSlug')
        .addSelect('food.food_category_id', 'foodCategoryId')
        .addSelect('item.name', 'itemName')
        .addSelect('variant.name', 'variantName')
        .addSelect('subVariant.name', 'subVariantName')
        .addSelect('item.sku', 'sku')
        .addSelect('item.price', 'price')
        .addSelect('item.is_default', 'isDefault')
        .addSelect('item.is_active', 'isActive')
        .addSelect('item.sort_order', 'sortOrder')
        .from('food_variants', 'item')
        .innerJoin('foods', 'food', 'food.id = item.food_id AND food.deleted_at IS NULL')
        .leftJoin('variants', 'variant', 'variant.id = item.variant_id')
        .leftJoin('sub_variants', 'subVariant', 'subVariant.id = item.sub_variant_id')
        .where('item.deleted_at IS NULL')
        .orderBy('food.id', 'ASC')
        .addOrderBy('item.sort_order', 'ASC')
        .addOrderBy('item.id', 'ASC')
        .getRawMany<{
          foodId: number
          foodName: string
          foodSlug: string
          foodCategoryId: number | null
          itemName: string
          variantName: string | null
          subVariantName: string | null
          sku: string | null
          price: number
          isDefault: boolean
          isActive: boolean
          sortOrder: number
        }>(),
      this.foodsRepository.manager
        .createQueryBuilder()
        .select("'Food'", 'recordType')
        .addSelect('food.name', 'foodName')
        .addSelect('food.slug', 'foodSlug')
        .addSelect('food.name', 'itemName')
        .addSelect('outlet.name', 'outletName')
        .addSelect('foodOutlet.price', 'priceOverride')
        .addSelect('foodOutlet.is_available', 'isAvailable')
        .addSelect('foodOutlet.is_active', 'isActive')
        .from('food_outlets', 'foodOutlet')
        .innerJoin('foods', 'food', 'food.id = foodOutlet.food_id AND food.deleted_at IS NULL')
        .innerJoin('outlets', 'outlet', 'outlet.id = foodOutlet.outlet_id')
        .getRawMany<{
          recordType: string
          foodName: string
          foodSlug: string
          itemName: string
          variantName: string | null
          subVariantName: string | null
          outletName: string
          priceOverride: number | null
          isAvailable: boolean
          isActive: boolean
        }>()
        .then(async (foodRows) => {
          const itemRows = await this.foodsRepository.manager
            .createQueryBuilder()
            .select("'Food item'", 'recordType')
            .addSelect('food.name', 'foodName')
            .addSelect('food.slug', 'foodSlug')
            .addSelect('item.name', 'itemName')
            .addSelect('variant.name', 'variantName')
            .addSelect('subVariant.name', 'subVariantName')
            .addSelect('outlet.name', 'outletName')
            .addSelect('itemOutlet.price', 'priceOverride')
            .addSelect('itemOutlet.is_available', 'isAvailable')
            .addSelect('itemOutlet.is_active', 'isActive')
            .from('food_variant_outlets', 'itemOutlet')
            .innerJoin('food_variants', 'item', 'item.id = itemOutlet.food_variant_id AND item.deleted_at IS NULL')
            .innerJoin('foods', 'food', 'food.id = item.food_id AND food.deleted_at IS NULL')
            .leftJoin('variants', 'variant', 'variant.id = item.variant_id')
            .leftJoin('sub_variants', 'subVariant', 'subVariant.id = item.sub_variant_id')
            .innerJoin('outlets', 'outlet', 'outlet.id = itemOutlet.outlet_id')
            .getRawMany<{
              recordType: string
              foodName: string
              foodSlug: string
              itemName: string
              variantName: string | null
              subVariantName: string | null
              outletName: string
              priceOverride: number | null
              isAvailable: boolean
              isActive: boolean
            }>()
          return [...foodRows, ...itemRows]
        }),
      this.foodsRepository.manager
        .createQueryBuilder()
        .select('food.name', 'foodName')
        .addSelect('food.slug', 'foodSlug')
        .addSelect('addonGroup.name', 'groupName')
        .addSelect('addonGroup.is_required', 'isRequired')
        .addSelect('addonGroup.min_select', 'minSelect')
        .addSelect('addonGroup.max_select', 'maxSelect')
        .addSelect('addon.name', 'addonName')
        .addSelect('addon.price', 'addonPrice')
        .addSelect('addon.is_active', 'addonIsActive')
        .from('food_addon_groups', 'foodAddonGroup')
        .innerJoin('foods', 'food', 'food.id = foodAddonGroup.food_id AND food.deleted_at IS NULL')
        .innerJoin('addon_groups', 'addonGroup', 'addonGroup.id = foodAddonGroup.addon_group_id AND addonGroup.deleted_at IS NULL')
        .leftJoin('addons', 'addon', 'addon.addon_group_id = addonGroup.id AND addon.deleted_at IS NULL')
        .orderBy('food.id', 'ASC')
        .addOrderBy('addonGroup.sort_order', 'ASC')
        .addOrderBy('addon.sort_order', 'ASC')
        .getRawMany<{
          foodName: string
          foodSlug: string
          groupName: string
          isRequired: boolean
          minSelect: number
          maxSelect: number | null
          addonName: string | null
          addonPrice: number | null
          addonIsActive: boolean | null
        }>(),
    ]);
    const [variants, subVariants] = await Promise.all([
      this.foodsRepository.manager
        .createQueryBuilder()
        .select('name', 'name')
        .addSelect('sku_segment', 'skuSegment')
        .addSelect('is_active', 'isActive')
        .addSelect('sort_order', 'sortOrder')
        .from('variants', 'variant')
        .orderBy('sort_order', 'ASC')
        .addOrderBy('name', 'ASC')
        .getRawMany<{ name: string; skuSegment: string | null; isActive: boolean; sortOrder: number }>(),
      this.foodsRepository.manager
        .createQueryBuilder()
        .select('name', 'name')
        .addSelect('sku_segment', 'skuSegment')
        .addSelect('is_active', 'isActive')
        .addSelect('sort_order', 'sortOrder')
        .from('sub_variants', 'subVariant')
        .orderBy('sort_order', 'ASC')
        .addOrderBy('name', 'ASC')
        .getRawMany<{ name: string; skuSegment: string | null; isActive: boolean; sortOrder: number }>(),
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Foods');
    sheet.addRow([
      'name', 'slug', 'sku', 'category', 'itemType', 'basePrice', 'foodType',
      'departmentType', 'shortDescription', 'description', 'imageUrl',
      'hasVariants', 'hasAddons', 'isTaxable', 'isDiscountable', 'isFeatured',
      'isActive', 'preparationTime', 'sortOrder',
    ]);
    for (const food of foods) {
      sheet.addRow([
        food.name,
        food.slug,
        food.sku ?? '',
        food.foodCategoryId ? (categoryById.get(food.foodCategoryId) ?? '') : '',
        food.itemType,
        food.basePrice,
        food.foodType ?? '',
        food.departmentType ?? '',
        food.shortDescription ?? '',
        food.description ?? '',
        food.imageUrl ?? '',
        food.hasVariants,
        food.hasAddons,
        food.isTaxable,
        food.isDiscountable,
        food.isFeatured,
        food.isActive,
        food.preparationTime ?? '',
        food.sortOrder,
      ]);
    }

    const itemsSheet = workbook.addWorksheet('Food items');
    itemsSheet.addRow([
      'foodName', 'foodSlug', 'category', 'itemName', 'variant', 'subVariant',
      'sku', 'price', 'isDefault', 'isActive', 'sortOrder',
    ]);
    const foodsWithItems = new Set(items.map((item) => Number(item.foodId)));
    for (const item of items) {
      itemsSheet.addRow([
        item.foodName,
        item.foodSlug,
        item.foodCategoryId ? (categoryById.get(Number(item.foodCategoryId)) ?? '') : '',
        item.itemName,
        item.variantName ?? '',
        item.subVariantName ?? '',
        item.sku ?? '',
        item.price,
        item.isDefault,
        item.isActive,
        item.sortOrder,
      ]);
    }

    // Export the shared option catalogs as well as the food-item pairings
    // above. This preserves configured sub-variants even when no current food
    // item references them.
    const variantsSheet = workbook.addWorksheet('Variants');
    variantsSheet.addRow(['type', 'name', 'skuSegment', 'isActive', 'sortOrder']);
    for (const variant of variants) {
      variantsSheet.addRow(['Variant', variant.name, variant.skuSegment ?? '', variant.isActive, variant.sortOrder]);
    }
    for (const subVariant of subVariants) {
      variantsSheet.addRow(['Sub-variant', subVariant.name, subVariant.skuSegment ?? '', subVariant.isActive, subVariant.sortOrder]);
    }
    // Older/simple foods can have their sell price directly on the food row
    // and no food_variants record. Keep those in the actual-items sheet too.
    for (const food of foods) {
      if (foodsWithItems.has(food.id)) continue;
      itemsSheet.addRow([
        food.name,
        food.slug,
        food.foodCategoryId ? (categoryById.get(food.foodCategoryId) ?? '') : '',
        food.name,
        '',
        '',
        food.sku ?? '',
        food.basePrice,
        true,
        food.isActive,
        food.sortOrder,
      ]);
    }

    const categoriesSheet = workbook.addWorksheet('Categories');
    categoriesSheet.addRow(['name', 'slug', 'parentCategory', 'description', 'image', 'isActive', 'sortOrder']);
    const categoryByParentId = new Map(categories.map((category) => [category.id, category]));
    for (const category of categories) {
      categoriesSheet.addRow([
        category.name,
        category.slug,
        category.parentId ? (categoryByParentId.get(category.parentId)?.name ?? '') : '',
        category.description ?? '',
        category.image ?? '',
        category.isActive,
        category.sortOrder,
      ]);
    }

    const addonsSheet = workbook.addWorksheet('Add-ons');
    addonsSheet.addRow([
      'foodName', 'foodSlug', 'groupName', 'isRequired', 'minSelect', 'maxSelect',
      'addonName', 'addonPrice', 'addonIsActive',
    ]);
    for (const row of addonRows) {
      addonsSheet.addRow([
        row.foodName,
        row.foodSlug,
        row.groupName,
        row.isRequired,
        row.minSelect,
        row.maxSelect ?? '',
        row.addonName ?? '',
        row.addonPrice ?? '',
        row.addonIsActive ?? '',
      ]);
    }

    const outletSheet = workbook.addWorksheet('Outlet pricing');
    outletSheet.addRow([
      'recordType', 'foodName', 'foodSlug', 'itemName', 'variant', 'subVariant',
      'outlet', 'priceOverride', 'isAvailable', 'isActive',
    ]);
    for (const row of outletPricing) {
      outletSheet.addRow([
        row.recordType,
        row.foodName,
        row.foodSlug,
        row.itemName,
        row.variantName ?? '',
        row.subVariantName ?? '',
        row.outletName,
        row.priceOverride ?? '',
        row.isAvailable,
        row.isActive,
      ]);
    }

    for (const worksheet of workbook.worksheets) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      worksheet.autoFilter = {
        from: 'A1',
        to: worksheet.getCell(worksheet.rowCount, worksheet.columnCount).address,
      };
      worksheet.getRow(1).font = { bold: true };
      worksheet.columns.forEach((column) => {
        if (column.number === undefined) return;
        const contentWidth = worksheet
          .getColumn(column.number)
          .values.reduce<number>(
            (width, value) => Math.max(width, String(value ?? '').length + 2),
            14,
          );
        column.width = Math.min(contentWidth, 48);
      });
    }
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}

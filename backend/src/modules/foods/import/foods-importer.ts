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
import type { FoodItemType } from '../entities/food.entity';
import { Food } from '../entities/food.entity';
import { FoodVariant } from '../../food-variants/entities/food-variant.entity';
import { Variant } from '../../variants/entities/variant.entity';
import { SubVariant } from '../../variants/entities/sub-variant.entity';
import { SkuCompositionService } from '../sku-composition.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { scopedWhere, tenantFields } from '../../../common/tenant/tenant-scope';

/**
 * Header aliases -> the logical column key. Covers both a plain
 * "name,slug,sku,..." sheet and a WordPress/WooCommerce post
 * export ("post_title", "post_name", "regular_price", "tax:product_cat",
 * ...), since that's what most menu migrations bring in. postStatus/
 * postParent aren't Food fields — they're read only by rowFilter, to drop
 * trashed posts and WooCommerce variation child rows. Unchanged from the
 * pre-migration foods-import.util.ts's HEADER_ALIASES.
 *
 * New additions:
 *   basePrice  → the sell price on the FoodVariant row (required when no
 *                separate variant column is present — i.e. the food has a
 *                single sellable item with no variant dimension).
 *   variant    → name of the global Variant (e.g. "Chicken") — resolved to
 *                a variantId at validate time. Blank = no variant.
 *   subVariant → name of the global SubVariant (e.g. "Full") — resolved to
 *                a subVariantId at validate time. Blank = no sub-variant.
 */
const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  posttitle: 'name',
  slug: 'slug',
  postname: 'slug',
  sku: 'skuSegment',
  skusegment: 'skuSegment',
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
  images: 'imageUrl',
  image: 'imageUrl',
  poststatus: 'postStatus',
  postparent: 'postParent',
  // Price / variant fields
  baseprice: 'basePrice',
  price: 'basePrice',
  regularprice: 'basePrice',
  variant: 'variant',
  variation: 'variant',
  subvariant: 'subVariant',
  'sub variant': 'subVariant',
  subvariation: 'subVariant',
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
  skuSegment: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  foodCategory: string | null;
  foodCategoryName: string | null;
  foodCategoryId: number | null;
  itemType: FoodItemType;
  departmentType: OutletDepartmentType | null;
  /** Parsed sell price for the FoodVariant row. null = no price column present. */
  basePrice: number | null;
  /**
   * Echo-back fields — keyed exactly as the frontend column keys so the
   * wizard's extractRaw reads them correctly. variantName/subVariantName
   * are the same values; kept as aliases for commitRows readability.
   */
  variant: string | null;
  variantName: string | null;
  variantId: number | null;
  subVariant: string | null;
  subVariantName: string | null;
  subVariantId: number | null;
}

/**
 * Foods — identity: slug. Create only, same as the
 * pre-migration Foods importer this replaces: a row whose slug or sku
 * collides with an existing food is a validation error, not an update
 * (unlike Ingredients/Customers/Suppliers, which upsert — Foods' prior
 * behavior is preserved as-is here rather than retroactively changed).
 * Category is resolved by name but, matching prior behavior, an unmatched
 * category is NOT an error — most legacy category names won't exist yet, so
 * the row still imports without one rather than being rejected.
 *
 * When basePrice / variant / subVariant columns are present a FoodVariant
 * row is also created in commitRows so the food is immediately sellable.
 * Variant and SubVariant are resolved by name (case-insensitive) from the
 * tenant's global lists. An unrecognised name IS an error — unlike category,
 * a missing variant would produce a broken FoodVariant with a null FK that
 * silently falls back to the wrong item at order time.
 *
 * Category is resolved by name the same way, but an unmatched name is never
 * an error — commitRows auto-creates it (same find-or-create shape as
 * variant/subVariant) so legacy sheets bring their categories with them
 * instead of importing every row as "Uncategorized".
 *
 * Every row of the chain below the Food itself — category, variant,
 * sub-variant, and the FoodVariant (food item) — is find-or-create: a
 * second import of the same sheet (or a sheet that only adds rows to an
 * existing food) reuses whatever already matches by name/combination
 * instead of creating duplicates, updating the FoodVariant's price in
 * place if it changed.
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
    @InjectRepository(FoodVariant)
    private readonly foodVariantsRepository: Repository<FoodVariant>,
    @InjectRepository(Variant)
    private readonly variantsRepository: Repository<Variant>,
    @InjectRepository(SubVariant)
    private readonly subVariantsRepository: Repository<SubVariant>,
    private readonly skuCompositionService: SkuCompositionService,
    private readonly tenantContext: TenantContext = new TenantContext(),
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<FoodImportRow[]> {
    const [existingFoods, categories, variants, subVariants] = await Promise.all([
      this.foodsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { slug: true, name: true } }),
      this.foodCategoriesRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.variantsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.subVariantsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
    ]);
    const existingSlugs = new Set(existingFoods.map((f) => f.slug));
    const existingNames = new Set(existingFoods.map((f) => f.name.trim().toLowerCase()));
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const variantByName = new Map(variants.map((v) => [v.name.trim().toLowerCase(), v.id]));
    const subVariantByName = new Map(subVariants.map((sv) => [sv.name.trim().toLowerCase(), sv.id]));

    const seenSlugs = new Set<string>();
    // Rows repeating a food name (e.g. "Hukka" with a different variant on
    // each row) are grouped into one food with several FoodVariants by
    // commitRows — they don't get their own slug, so duplicate-slug errors
    // don't apply past the row that actually creates the food.
    const seenNames = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const errors: string[] = [];

      const name = raw.name?.trim() ?? '';
      if (!name || name.length < 2) {
        errors.push('Name is required (min 2 characters)');
      }

      const nameKey = name.toLowerCase();
      const isGroupedVariantRow = seenNames.has(nameKey) || existingNames.has(nameKey);
      seenNames.add(nameKey);

      let slug = raw.slug?.trim().toLowerCase() ?? '';
      if (!slug) slug = slugify(name);
      if (!isGroupedVariantRow) {
        if (!FOOD_SLUG_PATTERN.test(slug)) {
          errors.push('Slug must be lowercase, alphanumeric, dot or hyphen-separated');
        } else if (existingSlugs.has(slug) || seenSlugs.has(slug)) {
          errors.push(`Slug "${slug}" is already in use`);
        } else {
          seenSlugs.add(slug);
        }
      }

      const skuSegment = raw.skuSegment?.trim() || null;

      // WooCommerce exports can list a category path/multiple terms
      // ("Drinks > Cold Drinks", "Drinks, Soft Drinks") — only the first is
      // used to resolve an id here.
      const foodCategoryRaw = raw.foodCategory?.split(/[>,|]/)[0]?.trim() || null;
      const foodCategoryId = foodCategoryRaw ? (categoryByName.get(foodCategoryRaw.toLowerCase()) ?? null) : null;

      const itemType = raw.itemType?.trim() || 'ready_made';
      if (itemType.length > 255) {
        errors.push('Item type must be 255 characters or fewer');
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

      // ── Price ──────────────────────────────────────────────────────────────
      const basePriceRaw = raw.basePrice?.trim() || null;
      let basePrice: number | null = null;
      if (basePriceRaw !== null) {
        const parsed = parseFloat(basePriceRaw);
        if (isNaN(parsed) || parsed < 0) {
          errors.push('Base price must be a non-negative number');
        } else {
          basePrice = parsed;
        }
      }

      // ── Variant ────────────────────────────────────────────────────────────
      // Unknown names are NOT an error — commitRows auto-creates the Variant
      // inside the transaction. The id is resolved now if it already exists,
      // otherwise left null for commit to fill in.
      const variantNameRaw = raw.variant?.trim() || null;
      const variantId = variantNameRaw ? (variantByName.get(variantNameRaw.toLowerCase()) ?? null) : null;

      // ── Sub-variant ────────────────────────────────────────────────────────
      const subVariantNameRaw = raw.subVariant?.trim() || null;
      const subVariantId = subVariantNameRaw ? (subVariantByName.get(subVariantNameRaw.toLowerCase()) ?? null) : null;

      return {
        rowNumber,
        name,
        slug,
        skuSegment,
        shortDescription: raw.shortDescription?.trim() || null,
        imageUrl: raw.imageUrl ? firstImageUrl(raw.imageUrl.trim()) || null : null,
        foodCategory: foodCategoryRaw,
        foodCategoryName: foodCategoryRaw,
        foodCategoryId,
        itemType: itemType as FoodItemType,
        departmentType,
        basePrice,
        // Echo back under both the column-key name (for the wizard) and the
        // internal alias (used by commitRows).
        variant: variantNameRaw,
        variantName: variantNameRaw,
        variantId,
        subVariant: subVariantNameRaw,
        subVariantName: subVariantNameRaw,
        subVariantId,
        errors,
      };
    });
  }

  async commitRows(rows: FoodImportRow[], manager: EntityManager): Promise<ImportCommitResult> {
    const foodRepo = manager.getRepository(Food);
    const foodVariantRepo = manager.getRepository(FoodVariant);
    const variantRepo = manager.getRepository(Variant);
    const subVariantRepo = manager.getRepository(SubVariant);
    const foodCategoryRepo = manager.getRepository(FoodCategory);
    const failures: ImportCommitResult['failures'] = [];
    const succeeded: ImportCommitResult['succeeded'] = [];

    // Per-batch caches so repeated names in the same chunk (e.g. 10 rows of
    // "Chicken") only hit the DB once. Keys are lower-cased display names.
    const variantIdCache = new Map<string, number>();
    const subVariantIdCache = new Map<string, number>();
    const categoryIdCache = new Map<string, number>();
    // Repeated food names (e.g. "Hukka" with a different variant per row)
    // share one Food row instead of each row creating its own.
    const foodIdCache = new Map<string, number>();
    // Keyed by foodId:variantId:subVariantId so re-importing the same sheet
    // (or a sheet that only adds new rows to an existing food) reuses the
    // matching FoodVariant instead of creating a duplicate sellable item.
    const foodVariantIdCache = new Map<string, number>();

    /**
     * Finds the category by name in this tenant, or creates it. Slug is
     * globally unique (not per-tenant), so a slugified name collision with
     * another tenant's category falls back to a tenant-suffixed slug rather
     * than failing the row.
     */
    const resolveCategory = async (name: string, rowNumber: number): Promise<number> => {
      const key = name.toLowerCase();
      const cached = categoryIdCache.get(key);
      if (cached !== undefined) return cached;
      const existing = await foodCategoryRepo.findOne({
        where: scopedWhere(this.tenantContext, { name }),
        select: { id: true },
      });
      if (existing) {
        categoryIdCache.set(key, existing.id);
        return existing.id;
      }
      const baseSlug = slugify(name) || 'category';
      // A failed INSERT aborts the surrounding SAVEPOINT scope until rolled
      // back to a recovery point — nest one here so a slug collision (from
      // another tenant's category of the same name) can be retried with a
      // suffixed slug instead of poisoning the row's own outer savepoint.
      const nested = `import_category_${rowNumber}_${categoryIdCache.size}`;
      await manager.query(`SAVEPOINT "${nested}"`);
      try {
        const created = await foodCategoryRepo.save(
          foodCategoryRepo.create({ name, slug: baseSlug, ...tenantFields(this.tenantContext) }),
        );
        await manager.query(`RELEASE SAVEPOINT "${nested}"`);
        categoryIdCache.set(key, created.id);
        return created.id;
      } catch {
        await manager.query(`ROLLBACK TO SAVEPOINT "${nested}"`);
        const slug = `${baseSlug}-${this.tenantContext.getTenantId() ?? 'x'}`;
        const created = await foodCategoryRepo.save(
          foodCategoryRepo.create({ name, slug, ...tenantFields(this.tenantContext) }),
        );
        await manager.query(`RELEASE SAVEPOINT "${nested}"`);
        categoryIdCache.set(key, created.id);
        return created.id;
      }
    };

    /** Finds the variant by name in this tenant, or creates it. */
    const resolveVariant = async (name: string): Promise<number> => {
      const key = name.toLowerCase();
      const cached = variantIdCache.get(key);
      if (cached !== undefined) return cached;
      // Try to find an existing one first (may have been created by a prior chunk).
      const existing = await variantRepo.findOne({
        where: scopedWhere(this.tenantContext, { name }),
        select: { id: true },
      });
      if (existing) {
        variantIdCache.set(key, existing.id);
        return existing.id;
      }
      const created = await variantRepo.save(
        variantRepo.create({ name, ...tenantFields(this.tenantContext) }),
      );
      variantIdCache.set(key, created.id);
      return created.id;
    };

    /** Finds the sub-variant by name in this tenant, or creates it. */
    const resolveSubVariant = async (name: string): Promise<number> => {
      const key = name.toLowerCase();
      const cached = subVariantIdCache.get(key);
      if (cached !== undefined) return cached;
      const existing = await subVariantRepo.findOne({
        where: scopedWhere(this.tenantContext, { name }),
        select: { id: true },
      });
      if (existing) {
        subVariantIdCache.set(key, existing.id);
        return existing.id;
      }
      const created = await subVariantRepo.save(
        subVariantRepo.create({ name, ...tenantFields(this.tenantContext) }),
      );
      subVariantIdCache.set(key, created.id);
      return created.id;
    };

    /**
     * Finds-or-creates the Food for this row's name. Rows sharing a name
     * (e.g. "Hukka" with a different variant per row) share one Food instead
     * of each row creating its own — food-level fields (slug, category, ...)
     * come from whichever row creates it; later rows only add a FoodVariant.
     */
    const resolveFood = async (
      row: FoodImportRow,
      resolvedCategoryId: number | null,
    ): Promise<{ id: number; created: boolean }> => {
      const key = row.name.trim().toLowerCase();
      const cached = foodIdCache.get(key);
      if (cached !== undefined) return { id: cached, created: false };
      const existing = await foodRepo.findOne({
        where: scopedWhere(this.tenantContext, { name: row.name }),
        select: { id: true },
      });
      if (existing) {
        foodIdCache.set(key, existing.id);
        return { id: existing.id, created: false };
      }
      const created = await foodRepo.save(
        foodRepo.create({
          ...tenantFields(this.tenantContext),
          foodCategoryId: resolvedCategoryId,
          name: row.name,
          slug: row.slug,
          skuSegment: row.skuSegment,
          shortDescription: row.shortDescription,
          imageUrl: row.imageUrl,
          itemType: row.itemType,
          departmentType: row.departmentType,
          hasVariants: row.basePrice !== null,
        }),
      );
      foodIdCache.set(key, created.id);
      return { id: created.id, created: true };
    };

    /**
     * Finds-or-creates the FoodVariant (food item) for this exact
     * foodId/variantId/subVariantId combination. Re-importing a sheet that
     * already produced this item — or adding new rows to a food that
     * already has it — updates its price in place rather than creating a
     * second, duplicate sellable item alongside it.
     */
    const resolveFoodVariant = async (
      foodId: number,
      variantId: number | null,
      subVariantId: number | null,
      name: string,
      price: number,
      isDefault: boolean,
    ): Promise<{ id: number; created: boolean }> => {
      const key = `${foodId}:${variantId ?? ''}:${subVariantId ?? ''}`;
      const cachedId = foodVariantIdCache.get(key);
      if (cachedId !== undefined) {
        await foodVariantRepo.update({ id: cachedId }, { price, name });
        return { id: cachedId, created: false };
      }
      const existing = await foodVariantRepo.findOne({
        where: scopedWhere(this.tenantContext, { foodId, variantId, subVariantId }),
        select: { id: true },
      });
      if (existing) {
        foodVariantIdCache.set(key, existing.id);
        await foodVariantRepo.update({ id: existing.id }, { price, name });
        return { id: existing.id, created: false };
      }
      const created = await foodVariantRepo.save(
        foodVariantRepo.create({
          ...tenantFields(this.tenantContext),
          foodId,
          variantId,
          subVariantId,
          name,
          price,
          isDefault,
          sortOrder: 0,
        }),
      );
      foodVariantIdCache.set(key, created.id);
      return { id: created.id, created: true };
    };

    for (const row of rows) {
      // Each row gets its own SAVEPOINT — without this, one row's constraint
      // violation aborts the whole shared chunk transaction, and every row
      // after it fails with a useless "current transaction is aborted"
      // instead of its own real error.
      const savepoint = `import_row_${row.rowNumber}`;
      await manager.query(`SAVEPOINT "${savepoint}"`);
      try {
        // 0. Resolve the category — auto-create if the name didn't match an
        //    existing one yet (find-or-create, same as variant/sub-variant).
        const resolvedCategoryId = row.foodCategoryName
          ? (row.foodCategoryId ?? (await resolveCategory(row.foodCategoryName, row.rowNumber)))
          : null;

        // 1. Find-or-create the Food record. Rows repeating a food name only
        //    add a FoodVariant to the food the first matching row created.
        const { id: foodId, created: foodCreated } = await resolveFood(row, resolvedCategoryId);

        // 2. Compose the Food's own SKU (segment only, no variant yet) —
        //    only needed the first time the food is created.
        if (foodCreated) {
          await this.skuCompositionService.recomposeFoodTree(foodId, manager);
        }

        // 3. If a price was provided, create the FoodVariant (sellable item).
        //    A FoodVariant is the only place price lives — without one the food
        //    appears in the menu but can't be added to an order.
        if (row.basePrice !== null) {
          // Resolve variant and sub-variant — auto-create if not yet in the DB.
          const resolvedVariantId = row.variantName
            ? (row.variantId ?? (await resolveVariant(row.variantName)))
            : null;
          const resolvedSubVariantId = row.subVariantName
            ? (row.subVariantId ?? (await resolveSubVariant(row.subVariantName)))
            : null;

          // Build the display name: "Tea", "Tea – Milk", "Tea – Milk – Full"
          const nameParts = [row.name];
          if (row.variantName) nameParts.push(row.variantName);
          if (row.subVariantName) nameParts.push(row.subVariantName);
          const fvName = nameParts.join(' – ');

          await resolveFoodVariant(
            foodId,
            resolvedVariantId,
            resolvedSubVariantId,
            fvName,
            row.basePrice,
            // Only the row that created the food gets the default item —
            // otherwise every sibling variant row would claim isDefault.
            foodCreated,
          );

          // Recompose so the FoodVariant gets its composed SKU too.
          await this.skuCompositionService.recomposeFoodTree(foodId, manager);

          if (!foodCreated) {
            // An existing food that previously had no variants (hasVariants
            // false) now sells through this new FoodVariant.
            await foodRepo.update({ id: foodId }, { hasVariants: true });
          }
        }

        await manager.query(`RELEASE SAVEPOINT "${savepoint}"`);
        succeeded.push({ rowNumber: row.rowNumber, entityId: foodId });
      } catch (error) {
        await manager.query(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
        failures.push({ rowNumber: row.rowNumber, error: error instanceof Error ? error.message : 'Failed to create food' });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Foods');
    sheet.addRow(['name', 'slug', 'sku', 'category', 'item type', 'basePrice', 'variant', 'sub variant']);
    sheet.addRow(['Tea', 'black-tea', 'IK01', 'hot beverage', 'kitchen', 25, 'Black', '']);
    sheet.addRow(['Tea', 'special-tea', 'IK02', 'hot beverage', 'kitchen', 60, 'Special', '']);
    sheet.addRow(['Margherita Pizza', 'margherita-pizza', 'PIZZA', 'Pizza', 'kitchen', 450, '', '']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildExport(): Promise<Buffer> {
    const [foods, categories, foodVariants, variants, subVariants] = await Promise.all([
      this.foodsRepository.find({ where: scopedWhere(this.tenantContext, {}), order: { id: 'ASC' } }),
      this.foodCategoriesRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.foodVariantsRepository.find({ where: scopedWhere(this.tenantContext, { isDefault: true }), order: { foodId: 'ASC' } }),
      this.variantsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.subVariantsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
    ]);

    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const variantById = new Map(variants.map((v) => [v.id, v.name]));
    const subVariantById = new Map(subVariants.map((sv) => [sv.id, sv.name]));
    // Default FoodVariant per food (first one found since we ordered by foodId).
    const fvByFoodId = new Map(foodVariants.map((fv) => [fv.foodId, fv]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Foods');
    sheet.addRow(['name', 'slug', 'sku', 'category', 'item type', 'basePrice', 'variant', 'sub variant']);
    for (const food of foods) {
      const fv = fvByFoodId.get(food.id);
      sheet.addRow([
        food.name,
        food.slug,
        food.skuSegment ?? '',
        food.foodCategoryId ? (categoryById.get(food.foodCategoryId) ?? '') : '',
        food.itemType,
        fv?.price ?? '',
        fv?.variantId ? (variantById.get(fv.variantId) ?? '') : '',
        fv?.subVariantId ? (subVariantById.get(fv.subVariantId) ?? '') : '',
      ]);
    }
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}

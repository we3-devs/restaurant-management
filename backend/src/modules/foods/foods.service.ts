import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { FoodCategoriesService } from '../food-categories/food-categories.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { OutletsService } from '../outlets/outlets.service';
import { UnitsService } from '../units/units.service';
import type { OutletDepartmentType } from '../outlet-departments/entities/outlet-department.entity';
import { CreateFoodRecipeDto } from './dto/create-food-recipe.dto';
import { CreateFoodDto } from './dto/create-food.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { UpdateFoodRecipeDto } from './dto/update-food-recipe.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { UpsertFoodOutletDto } from './dto/upsert-food-outlet.dto';
import { FoodResponseDto } from './dto/food-response.dto';
import { FoodInventoryTrackingDto, SetInventoryTrackingDto } from './dto/set-inventory-tracking.dto';
import { FoodOutlet } from './entities/food-outlet.entity';
import { FoodRecipe } from './entities/food-recipe.entity';
import { Food } from './entities/food.entity';
import { FoodVariant } from '../food-variants/entities/food-variant.entity';
import { FoodCategory } from '../food-categories/entities/food-category.entity';
import { Variant } from '../variants/entities/variant.entity';
import { SubVariant } from '../variants/entities/sub-variant.entity';
import { SkuCompositionService } from './sku-composition.service';
import { normaliseSkuSegment } from '../../common/sku.util';
import { TenantContext } from '../../common/tenant/tenant-context';
import { scopedWhere, tenantFields } from '../../common/tenant/tenant-scope';

export interface PublicFood {
  id: number;
  foodCategoryId: number | null;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  hasVariants: boolean;
}

export interface PublicMenu {
  foods: PublicFood[];
  categories: { id: number; parentId: number | null; name: string }[];
  variants: { id: number; foodId: number; variantId: number | null; subVariantId: number | null; name: string; price: number; isDefault: boolean }[];
  variantNames: { id: number; name: string; sortOrder: number }[];
  subVariantNames: { id: number; name: string; sortOrder: number }[];
}

const PUBLIC_MENU_TTL_MS = 60_000;

/** Column length the released slugs have to keep fitting into — see Food/FoodCategory's slug @Column definitions. */
const RESET_SLUG_MAX_LENGTH = 255;

/**
 * Stamps a reset row's slug so it stops occupying the value, freeing it for a fresh food/category of the same name —
 * same trick as IngredientsService's releasedIdentifier(): the id keeps it unique even if the same base value is
 * reset twice, and the base (not the suffix) is trimmed when the two together would overflow the column.
 */
function releasedSlug(slug: string, id: number, maxLength: number): string {
  const suffix = `-deleted-${id}`;
  return `${slug.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
}

/** Food item names are free text — "1L" as often as "Coke 1L". */
function foodItemStockName(food: Food, variant: FoodVariant): string {
  return variant.name.toLowerCase().includes(food.name.toLowerCase()) ? variant.name : `${food.name} ${variant.name}`;
}

@Injectable()
export class FoodsService {
  constructor(
    @InjectRepository(Food)
    private readonly foodsRepository: Repository<Food>,
    @InjectRepository(FoodOutlet)
    private readonly foodOutletsRepository: Repository<FoodOutlet>,
    @InjectRepository(FoodRecipe)
    private readonly foodRecipesRepository: Repository<FoodRecipe>,
    @InjectRepository(FoodVariant)
    private readonly foodVariantsRepository: Repository<FoodVariant>,
    @InjectRepository(FoodCategory)
    private readonly categoriesRepository: Repository<FoodCategory>,
    @InjectRepository(Variant)
    private readonly variantsRepository: Repository<Variant>,
    @InjectRepository(SubVariant)
    private readonly subVariantsRepository: Repository<SubVariant>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly foodCategoriesService: FoodCategoriesService,
    private readonly outletsService: OutletsService,
    private readonly ingredientsService: IngredientsService,
    private readonly unitsService: UnitsService,
    private readonly skuCompositionService: SkuCompositionService,
    private readonly tenantContext: TenantContext,
    private readonly dataSource: DataSource,
  ) {}

  async findPublicMenu(): Promise<PublicMenu> {
    const tenantId = this.tenantContext.getTenantId();
    const key = `public-menu:${tenantId ?? 'none'}`;
    const cached = await this.cache.get<PublicMenu>(key);
    if (cached) return cached;
    const [foods, categories, variants, variantNames, subVariantNames] = await Promise.all([
      this.foodsRepository.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.categoriesRepository.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.foodVariantsRepository.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.variantsRepository.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.subVariantsRepository.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
    ]);
    const menu = {
      foods: foods.map(({ id, foodCategoryId, name, shortDescription, imageUrl, hasVariants }) => ({ id, foodCategoryId, name, shortDescription, imageUrl, hasVariants })),
      categories: categories.map(({ id, parentId, name }) => ({ id, parentId, name })),
      variants: variants.map(({ id, foodId, variantId, subVariantId, name, price, isDefault }) => ({ id, foodId, variantId, subVariantId, name, price, isDefault })),
      variantNames: variantNames.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
      subVariantNames: subVariantNames.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
    };
    await this.cache.set(key, menu, PUBLIC_MENU_TTL_MS);
    return menu;
  }

  /** Bulk name lookup for display-only consumers (e.g. order item rows) that need many foods by id without a full findAll roundtrip. */
  async findByIds(ids: number[]): Promise<Food[]> {
    if (ids.length === 0) return [];
    return this.foodsRepository.find({ where: scopedWhere(this.tenantContext, { id: In(ids) }) });
  }

  async findAll(
    query: ListFoodsQueryDto,
  ): Promise<PaginatedResponse<FoodResponseDto>> {
    const { page, limit, search, foodCategoryId } = query;
    let where: FindOptionsWhere<Food> = {};
    if (foodCategoryId !== undefined) {
      where.foodCategoryId = foodCategoryId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    where = scopedWhere(this.tenantContext, where);

    const [foods, total] = await this.foodsRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: foods.map((food) => this.toResponse(food)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Guest-facing menu listing for /guest ordering — active items only, and
   * only the fields already shown on a POS food card (no internal flags like
   * isTaxable/isDiscountable/preparationTime).
   */
  async findAllPublic(
    query: ListFoodsQueryDto,
  ): Promise<PaginatedResponse<PublicFood>> {
    const { page, limit, search, foodCategoryId } = query;
    let where: FindOptionsWhere<Food> = { isActive: true };
    if (foodCategoryId !== undefined) {
      where.foodCategoryId = foodCategoryId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    where = scopedWhere(this.tenantContext, where);

    const [foods, total] = await this.foodsRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: foods.map((food) => ({
        id: food.id,
        foodCategoryId: food.foodCategoryId,
        name: food.name,
        shortDescription: food.shortDescription,
        imageUrl: food.imageUrl,
        hasVariants: food.hasVariants,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by FoodVariantsService to validate a foodId. */
  async findOne(id: number): Promise<Food> {
    const food = await this.foodsRepository.findOne({ where: scopedWhere(this.tenantContext, { id }) });
    if (!food) {
      throw new NotFoundException(`Food ${id} not found`);
    }
    return food;
  }

  async create(dto: CreateFoodDto): Promise<Food> {
    if (dto.foodCategoryId !== undefined) {
      await this.foodCategoriesService.findOne(dto.foodCategoryId);
    }

    const food = this.foodsRepository.create({
      foodCategoryId: dto.foodCategoryId ?? null,
      name: dto.name,
      slug: dto.slug,
      shortDescription: dto.shortDescription ?? null,
      description: dto.description ?? null,
      skuSegment: dto.skuSegment ? normaliseSkuSegment(dto.skuSegment) : null,
      imageUrl: dto.imageUrl ?? null,
      itemType: dto.itemType ?? 'ready_made',
      departmentType:
        dto.departmentType ?? (dto.itemType === 'kitchen' ? 'kitchen' : null),
      isTaxable: dto.isTaxable ?? true,
      isDiscountable: dto.isDiscountable ?? true,
      isFeatured: dto.isFeatured ?? false,
      preparationTime: dto.preparationTime ?? null,
      sortOrder: dto.sortOrder ?? 0,
      ...tenantFields(this.tenantContext),
    });

    try {
      // Save and recompose share one transaction: a colliding composed SKU has
      // to roll the insert back, not leave a half-created food behind while the
      // caller sees an error.
      const id = await this.foodsRepository.manager.transaction(
        async (manager) => {
          const saved = await manager.save(food);
          // Always — a code is derived from the name, so every food gets one
          // without any segment being configured.
          await this.skuCompositionService.recomposeFoodTree(saved.id, manager);
          return saved.id;
        },
      );
      return this.findOne(id);
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.slug);
    }
  }

  async update(id: number, dto: UpdateFoodDto): Promise<Food> {
    const food = await this.findOne(id);
    // Captured before the assign below so a changed segment can be detected —
    // it has to cascade into every variant's composed SKU, not just this row.
    // Both feed the derived code, so either changing means every item of this
    // food needs its SKU rebuilt.
    const previousSegment = food.skuSegment;
    const previousName = food.name;

    if (dto.foodCategoryId !== undefined) {
      if (dto.foodCategoryId !== null) {
        await this.foodCategoriesService.findOne(dto.foodCategoryId);
      }
      food.foodCategoryId = dto.foodCategoryId;
    }

    Object.assign(food, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.shortDescription !== undefined && {
        shortDescription: dto.shortDescription,
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.skuSegment !== undefined && {
        skuSegment: dto.skuSegment ? normaliseSkuSegment(dto.skuSegment) : null,
      }),
      ...(dto.itemType !== undefined && { itemType: dto.itemType }),
      ...(dto.departmentType !== undefined && {
        departmentType: dto.departmentType,
      }),
      ...(dto.isTaxable !== undefined && { isTaxable: dto.isTaxable }),
      ...(dto.isDiscountable !== undefined && {
        isDiscountable: dto.isDiscountable,
      }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      ...(dto.preparationTime !== undefined && {
        preparationTime: dto.preparationTime,
      }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      const saved = await this.foodsRepository.save(food);
      if (saved.skuSegment !== previousSegment || saved.name !== previousName) {
        await this.skuCompositionService.recomposeFoodTree(saved.id);
        return this.findOne(saved.id);
      }
      return saved;
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the order_items.food_id
    // RESTRICT FK (no entity yet, but the real table already enforces it).
    await this.foodsRepository.softDelete(id);
  }

  /** Soft-deletes every requested id that actually belongs to the current tenant, silently ignoring the rest. */
  async removeMany(ids: number[]): Promise<{ deleted: number }> {
    const foods = await this.foodsRepository.find({ where: scopedWhere(this.tenantContext, { id: In(ids) }), select: { id: true } });
    if (foods.length === 0) return { deleted: 0 };
    await this.foodsRepository.softDelete(foods.map((food) => food.id));
    return { deleted: foods.length };
  }

  /** Sets (or clears, when null) departmentType across every requested id that belongs to the current tenant, silently ignoring the rest. */
  async updateDepartmentMany(ids: number[], departmentType: OutletDepartmentType | null): Promise<{ updated: number }> {
    const foods = await this.foodsRepository.find({ where: scopedWhere(this.tenantContext, { id: In(ids) }), select: { id: true } });
    if (foods.length === 0) return { updated: 0 };
    await this.foodsRepository.update(foods.map((food) => food.id), { departmentType });
    return { updated: foods.length };
  }

  /**
   * Wipes the whole food menu — every food category, food, and food item (FoodVariant) for the current tenant —
   * while preserving history: rows are soft-deleted, never hard-deleted, so past orders/analytics that reference
   * them keep resolving. Global Variant/SubVariant lists (shared taxonomy, not per-food data) are left untouched.
   *
   * food_categories.slug and foods.slug carry plain UNIQUE constraints that don't exclude soft-deleted rows (unlike
   * food_variants', which are already `WHERE deleted_at IS NULL` partial indexes), so without renaming them a fresh
   * category/food could never reuse the same slug after a reset. Mangled the same way IngredientsService.remove()
   * frees up a deleted ingredient's code/slug.
   */
  async resetAll(): Promise<{ deletedCategories: number; deletedFoods: number; deletedFoodVariants: number }> {
    return this.dataSource.transaction(async (manager) => {
      const foodRepo = manager.getRepository(Food);
      const categoryRepo = manager.getRepository(FoodCategory);
      const foodVariantRepo = manager.getRepository(FoodVariant);

      const [categories, foods, foodVariants] = await Promise.all([
        categoryRepo.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, slug: true } }),
        foodRepo.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, slug: true } }),
        foodVariantRepo.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true } }),
      ]);

      for (const category of categories) {
        await categoryRepo.update(category.id, { slug: releasedSlug(category.slug, category.id, RESET_SLUG_MAX_LENGTH) });
      }
      for (const food of foods) {
        await foodRepo.update(food.id, { slug: releasedSlug(food.slug, food.id, RESET_SLUG_MAX_LENGTH) });
      }

      if (foodVariants.length > 0) await foodVariantRepo.softDelete(foodVariants.map((fv) => fv.id));
      if (foods.length > 0) await foodRepo.softDelete(foods.map((food) => food.id));
      if (categories.length > 0) await categoryRepo.softDelete(categories.map((category) => category.id));

      return { deletedCategories: categories.length, deletedFoods: foods.length, deletedFoodVariants: foodVariants.length };
    });
  }

  /**
   * Sets exactly which active food items of each listed food are
   * stock-tracked (FoodVariant.inventoryIngredientId); unlisted items of that
   * food stop being tracked. shareStock puts every tracked item on one stock
   * item (Beer); otherwise each gets its own (Coke 1L / Coke 1.5L). Links that
   * already fit are kept so their stock carries over. Missing stock items are
   * FOOD-{foodId} / FOOD-ITEM-{foodVariantId} — reused when an earlier run
   * created them, so untracking and re-tracking keeps the same stock.
   * Untracking only clears the link: the stock item and its ledger stay.
   * Per-food failures are collected rather than aborting the batch.
   */
  async setInventoryTracking(dto: SetInventoryTrackingDto): Promise<{ updated: number; created: number; errors: string[] }> {
    // Rejected up front: every food would otherwise fail the same way, and a
    // non-stock category yields items no stock document will accept.
    if (dto.ingredientCategoryId !== undefined) {
      await this.ingredientsService.assertCategoryTrackable(dto.ingredientCategoryId);
    }

    const foods = await this.foodsRepository.find({
      where: scopedWhere(this.tenantContext, { id: In(dto.foods.map((entry) => entry.foodId)) }),
    });
    const foodById = new Map(foods.map((food) => [food.id, food]));
    const result = { updated: 0, created: 0, errors: [] as string[] };

    const ensureStockItem = async (code: string, name: string): Promise<{ id: number; code: string }> => {
      const existing = await this.ingredientsService.findByCode(code);
      if (existing) return existing;
      if (dto.ingredientCategoryId === undefined || dto.baseUnitId === undefined) {
        throw new BadRequestException('choose a stock category and counting unit for new stock items');
      }
      // Codes and slugs are unique across every tenant, and ids are too.
      const slug = code.toLowerCase();
      await this.ingredientsService.releaseDeletedIdentifiers({ code, slug });
      const ingredient = await this.ingredientsService.create({
        outletId: dto.outletId,
        ingredientCategoryId: dto.ingredientCategoryId,
        baseUnitId: dto.baseUnitId,
        name,
        slug,
        code,
      });
      result.created++;
      return ingredient;
    };

    for (const entry of dto.foods) {
      const food = foodById.get(entry.foodId);
      if (!food) {
        result.errors.push(`Food ${entry.foodId} not found`);
        continue;
      }
      if (food.itemType === 'kitchen') {
        result.errors.push(`${food.name}: kitchen dishes are stocked through their recipe`);
        continue;
      }
      try {
        if (await this.applyFoodTracking(food, entry, ensureStockItem)) result.updated++;
      } catch (error) {
        result.errors.push(`${food.name}: ${error instanceof Error ? error.message : 'failed to update stock tracking'}`);
      }
    }
    return result;
  }

  /** Returns whether any of the food's items changed. */
  private async applyFoodTracking(
    food: Food,
    entry: FoodInventoryTrackingDto,
    ensureStockItem: (code: string, name: string) => Promise<{ id: number; code: string }>,
  ): Promise<boolean> {
    const variants = await this.foodVariantsRepository.find({
      where: scopedWhere(this.tenantContext, { foodId: food.id, isActive: true }),
    });
    const trackedIds = new Set(entry.trackedFoodVariantIds);
    const unknown = [...trackedIds].filter((id) => !variants.some((variant) => variant.id === id));
    if (unknown.length > 0) {
      throw new BadRequestException(`food item ${unknown.join(', ')} is not an active item of this food`);
    }
    const tracked = variants.filter((variant) => trackedIds.has(variant.id));

    // A link to a deleted ingredient counts as untracked.
    const linkedIds = [
      ...new Set(variants.map((variant) => variant.inventoryIngredientId).filter((id): id is number => id !== null)),
    ];
    const codeById = new Map((await this.ingredientsService.findByIds(linkedIds)).map((ingredient) => [ingredient.id, ingredient.code]));
    const liveLink = (variant: FoodVariant) =>
      variant.inventoryIngredientId !== null && codeById.has(variant.inventoryIngredientId) ? variant.inventoryIngredientId : null;

    const target = new Map<number, number | null>(variants.map((variant) => [variant.id, null]));
    const foodCode = `FOOD-${food.id}`;

    if (entry.shareStock) {
      if (tracked.length > 0) {
        // Join an existing pool (e.g. one set up by hand) rather than orphan
        // its stock — unless that "pool" is really one size's own item.
        const links = [...new Set(tracked.map(liveLink).filter((id): id is number => id !== null))];
        const pool =
          links.length === 1 && (tracked.length === 1 || !codeById.get(links[0])!.startsWith('FOOD-ITEM-'))
            ? links[0]
            : (await ensureStockItem(foodCode, food.name)).id;
        for (const variant of tracked) target.set(variant.id, pool);
      }
    } else {
      const holders = new Map<number, number>();
      for (const variant of tracked) {
        const link = liveLink(variant);
        if (link !== null) holders.set(link, (holders.get(link) ?? 0) + 1);
      }
      for (const variant of tracked) {
        const link = liveLink(variant);
        const ownsLink =
          link !== null && holders.get(link) === 1 && !(variants.length > 1 && codeById.get(link) === foodCode);
        target.set(
          variant.id,
          ownsLink ? link : (await ensureStockItem(`FOOD-ITEM-${variant.id}`, foodItemStockName(food, variant))).id,
        );
      }
    }

    const changedByTarget = new Map<number | null, number[]>();
    for (const variant of variants) {
      const next = target.get(variant.id)!;
      if (variant.inventoryIngredientId === next) continue;
      changedByTarget.set(next, [...(changedByTarget.get(next) ?? []), variant.id]);
    }
    for (const [inventoryIngredientId, ids] of changedByTarget) {
      await this.foodVariantsRepository.update(ids, { inventoryIngredientId });
    }
    return changedByTarget.size > 0;
  }

  async listOutletOverrides(foodId: number): Promise<FoodOutlet[]> {
    await this.findOne(foodId);
    return this.foodOutletsRepository.find({ where: scopedWhere(this.tenantContext, { foodId }) });
  }

  async upsertOutletOverride(
    foodId: number,
    dto: UpsertFoodOutletDto,
  ): Promise<FoodOutlet> {
    await this.findOne(foodId);
    await this.outletsService.findOne(dto.outletId);

    let override = await this.foodOutletsRepository.findOne({
      where: scopedWhere(this.tenantContext, { foodId, outletId: dto.outletId }),
    });

    if (!override) {
      override = this.foodOutletsRepository.create({
        foodId,
        outletId: dto.outletId,
        ...tenantFields(this.tenantContext),
      });
    }
    override.price = dto.price ?? null;
    override.isAvailable = dto.isAvailable ?? true;

    return this.foodOutletsRepository.save(override);
  }

  async removeOutletOverride(foodId: number, outletId: number): Promise<void> {
    await this.findOne(foodId);
    await this.foodOutletsRepository.delete(scopedWhere(this.tenantContext, { foodId, outletId }));
  }

  /** Marks a food as having variants — called by FoodVariantsService on create. */
  async markHasVariants(foodId: number): Promise<void> {
    await this.foodsRepository.update(scopedWhere(this.tenantContext, { id: foodId }), { hasVariants: true });
  }

  /**
   * Resolves the price to charge for this food at a given outlet, checking
   * the Phase 4 per-outlet override first and falling back to the default food item.
   * Used by OrdersService to snapshot order_items.unit_price at add-time.
   */
  async resolvePriceForOutlet(
    foodId: number,
    outletId: number,
    preloadedFood?: Food,
  ): Promise<{ food: Food; price: number }> {
    const food = preloadedFood ?? (await this.findOne(foodId));
    const override = await this.foodOutletsRepository.findOne({
      where: scopedWhere(this.tenantContext, { foodId, outletId }),
    });

    if (override && !override.isAvailable) {
      throw new BadRequestException(
        `Food ${foodId} is not available at outlet ${outletId}`,
      );
    }

    const defaultItem = await this.foodVariantsRepository.findOne({
      where: scopedWhere(this.tenantContext, { foodId, isDefault: true, isActive: true }),
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (!defaultItem) {
      throw new BadRequestException(`Food ${foodId} has no active food item`);
    }
    return { food, price: override?.price ?? defaultItem.price };
  }

  /**
   * Same resolution as resolvePriceForOutlet, batched for a whole cart: 3
   * queries total instead of 2 per food. Built for OrdersService#addItemsBatch,
   * where placing an order with N no-variant items used to pay for this
   * resolution N times over — on a remote pooler each round trip alone runs
   * ~150-200ms, so that was the single largest cost in "place order" latency.
   */
  async resolvePricesForOutlet(
    foodIds: number[],
    outletId: number,
  ): Promise<Map<number, { food: Food; price: number }>> {
    const ids = [...new Set(foodIds)];
    if (ids.length === 0) return new Map();

    const [foods, overrides, defaultItems] = await Promise.all([
      this.findByIds(ids),
      this.foodOutletsRepository.find({
        where: scopedWhere(this.tenantContext, { foodId: In(ids), outletId }),
      }),
      this.foodVariantsRepository.find({
        where: scopedWhere(this.tenantContext, { foodId: In(ids), isDefault: true, isActive: true }),
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
    ]);

    const foodById = new Map(foods.map((food) => [food.id, food]));
    const overrideByFoodId = new Map(overrides.map((override) => [override.foodId, override]));
    // Several rows can match "default and active" per food in principle —
    // resolvePriceForOutlet's own query picks the first by sortOrder/id, so
    // this keeps only the first one seen per foodId to match it exactly.
    const defaultByFoodId = new Map<number, FoodVariant>();
    for (const item of defaultItems) {
      if (!defaultByFoodId.has(item.foodId)) defaultByFoodId.set(item.foodId, item);
    }

    const result = new Map<number, { food: Food; price: number }>();
    for (const foodId of ids) {
      const food = foodById.get(foodId);
      if (!food) throw new NotFoundException(`Food ${foodId} not found`);

      const override = overrideByFoodId.get(foodId);
      if (override && !override.isAvailable) {
        throw new BadRequestException(
          `Food ${foodId} is not available at outlet ${outletId}`,
        );
      }

      const defaultItem = defaultByFoodId.get(foodId);
      if (!defaultItem) {
        throw new BadRequestException(`Food ${foodId} has no active food item`);
      }
      result.set(foodId, { food, price: override?.price ?? defaultItem.price });
    }
    return result;
  }

  // ------------------------------------------------------------------ recipes

  async listRecipes(foodId: number): Promise<FoodRecipe[]> {
    await this.findOne(foodId);
    return this.foodRecipesRepository.find({ where: scopedWhere(this.tenantContext, { foodId }) });
  }

  async addRecipe(
    foodId: number,
    dto: CreateFoodRecipeDto,
  ): Promise<FoodRecipe> {
    await this.findOne(foodId);
    await this.ingredientsService.findOne(dto.ingredientId);
    await this.unitsService.findOne(dto.unitId);
    if (dto.foodVariantId !== undefined && dto.foodVariantId !== null) {
      const foodVariant = await this.foodVariantsRepository.findOne({
        where: scopedWhere(this.tenantContext, {
          id: dto.foodVariantId,
          foodId,
        }),
      });
      if (!foodVariant) {
        throw new NotFoundException(
          `Food variant ${dto.foodVariantId} not found on food ${foodId}`,
        );
      }
    }

    const recipe = this.foodRecipesRepository.create({
      foodId,
      foodVariantId: dto.foodVariantId ?? null,
      ingredientId: dto.ingredientId,
      unitId: dto.unitId,
      quantity: dto.quantity,
      wastageQuantity: dto.wastageQuantity ?? 0,
      ...tenantFields(this.tenantContext),
    });

    try {
      return await this.foodRecipesRepository.save(recipe);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'A recipe row for this food/variant/ingredient/unit combination already exists',
        );
      }
      throw error;
    }
  }

  async updateRecipe(
    foodId: number,
    recipeId: number,
    dto: UpdateFoodRecipeDto,
  ): Promise<FoodRecipe> {
    const recipe = await this.findRecipe(foodId, recipeId);

    Object.assign(recipe, {
      ...(dto.quantity !== undefined && { quantity: dto.quantity }),
      ...(dto.wastageQuantity !== undefined && {
        wastageQuantity: dto.wastageQuantity,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.foodRecipesRepository.save(recipe);
  }

  async removeRecipe(foodId: number, recipeId: number): Promise<void> {
    const recipe = await this.findRecipe(foodId, recipeId);
    await this.foodRecipesRepository.remove(recipe);
  }

  /**
   * Used by OrdersService to resolve required ingredients for a food/variant
   * combination — variant-specific rows override food-level (null) rows for
   * the same ingredient, same override semantics as FoodOutlet.
   */
  async resolveRecipes(
    foodId: number,
    foodVariantId: number | null,
  ): Promise<FoodRecipe[]> {
    const rows = await this.foodRecipesRepository.find({
      where: [
        scopedWhere(this.tenantContext, { foodId, foodVariantId: IsNull(), isActive: true }),
        ...(foodVariantId !== null
          ? [scopedWhere(this.tenantContext, { foodId, foodVariantId, isActive: true })]
          : []),
      ],
    });

    const byIngredient = new Map<number, FoodRecipe>();
    for (const row of rows) {
      const existing = byIngredient.get(row.ingredientId);
      if (
        !existing ||
        (existing.foodVariantId === null && row.foodVariantId !== null)
      ) {
        byIngredient.set(row.ingredientId, row);
      }
    }
    return [...byIngredient.values()];
  }

  private async findRecipe(
    foodId: number,
    recipeId: number,
  ): Promise<FoodRecipe> {
    const recipe = await this.foodRecipesRepository.findOne({
      where: scopedWhere(this.tenantContext, { id: recipeId, foodId }),
    });
    if (!recipe) {
      throw new NotFoundException(
        `Recipe ${recipeId} not found on food ${foodId}`,
      );
    }
    return recipe;
  }

  private mapUniqueViolation(
    error: unknown,
    slug?: string,
    sku?: string,
  ): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string; detail?: string })?.code ===
        '23505'
    ) {
      const detail = (error.driverError as { detail?: string })?.detail ?? '';
      if (detail.includes('sku')) {
        return new ConflictException(`SKU "${sku}" is already in use`);
      }
      return new ConflictException(`Slug "${slug}" is already in use`);
    }
    return error;
  }

  toResponse(food: Food): FoodResponseDto {
    return {
      id: food.id,
      foodCategoryId: food.foodCategoryId,
      name: food.name,
      slug: food.slug,
      skuSegment: food.skuSegment,
      imageUrl: food.imageUrl,
      shortDescription: food.shortDescription,
      description: food.description,
      itemType: food.itemType,
      departmentType: food.departmentType,
      hasVariants: food.hasVariants,
      isTaxable: food.isTaxable,
      isDiscountable: food.isDiscountable,
      isFeatured: food.isFeatured,
      isActive: food.isActive,
      preparationTime: food.preparationTime,
      sortOrder: food.sortOrder,
      createdAt: food.createdAt,
      updatedAt: food.updatedAt,
    };
  }
}

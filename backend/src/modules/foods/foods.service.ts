import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { AddonGroupsService } from '../addon-groups/addon-groups.service';
import { FoodCategoriesService } from '../food-categories/food-categories.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { OutletsService } from '../outlets/outlets.service';
import { UnitsService } from '../units/units.service';
import { AssignAddonGroupDto } from './dto/assign-addon-group.dto';
import { CreateFoodRecipeDto } from './dto/create-food-recipe.dto';
import { CreateFoodDto } from './dto/create-food.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { UpdateFoodRecipeDto } from './dto/update-food-recipe.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { UpsertFoodOutletDto } from './dto/upsert-food-outlet.dto';
import { FoodAddonGroup } from './entities/food-addon-group.entity';
import { FoodOutlet } from './entities/food-outlet.entity';
import { FoodRecipe } from './entities/food-recipe.entity';
import { Food } from './entities/food.entity';
import { SkuCompositionService } from './sku-composition.service';
import { normaliseSkuSegment } from '../../common/sku.util';

export interface PublicFood {
  id: number;
  foodCategoryId: number | null;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  basePrice: number;
  hasVariants: boolean;
  hasAddons: boolean;
}

@Injectable()
export class FoodsService {
  constructor(
    @InjectRepository(Food)
    private readonly foodsRepository: Repository<Food>,
    @InjectRepository(FoodOutlet)
    private readonly foodOutletsRepository: Repository<FoodOutlet>,
    @InjectRepository(FoodAddonGroup)
    private readonly foodAddonGroupsRepository: Repository<FoodAddonGroup>,
    @InjectRepository(FoodRecipe)
    private readonly foodRecipesRepository: Repository<FoodRecipe>,
    private readonly foodCategoriesService: FoodCategoriesService,
    private readonly outletsService: OutletsService,
    private readonly addonGroupsService: AddonGroupsService,
    private readonly ingredientsService: IngredientsService,
    private readonly unitsService: UnitsService,
    private readonly skuCompositionService: SkuCompositionService,
  ) {}

  /** Bulk name lookup for display-only consumers (e.g. order item rows) that need many foods by id without a full findAll roundtrip. */
  async findByIds(ids: number[]): Promise<Food[]> {
    if (ids.length === 0) return [];
    return this.foodsRepository.find({ where: { id: In(ids) } });
  }

  async findAll(query: ListFoodsQueryDto): Promise<PaginatedResponse<Food>> {
    const { page, limit, search, foodCategoryId } = query;
    const where: FindOptionsWhere<Food> = {};
    if (foodCategoryId !== undefined) {
      where.foodCategoryId = foodCategoryId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [foods, total] = await this.foodsRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: foods,
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
    const where: FindOptionsWhere<Food> = { isActive: true };
    if (foodCategoryId !== undefined) {
      where.foodCategoryId = foodCategoryId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

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
        basePrice: food.basePrice,
        hasVariants: food.hasVariants,
        hasAddons: food.hasAddons,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by FoodVariantsService to validate a foodId. */
  async findOne(id: number): Promise<Food> {
    const food = await this.foodsRepository.findOne({ where: { id } });
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
      sku: dto.sku ?? null,
      shortDescription: dto.shortDescription ?? null,
      description: dto.description ?? null,
      skuSegment: dto.skuSegment ? normaliseSkuSegment(dto.skuSegment) : null,
      imageUrl: dto.imageUrl ?? null,
      foodType: dto.foodType ?? null,
      itemType: dto.itemType ?? 'food',
      departmentType: dto.departmentType ?? null,
      basePrice: dto.basePrice ?? 0,
      isTaxable: dto.isTaxable ?? true,
      isDiscountable: dto.isDiscountable ?? true,
      isFeatured: dto.isFeatured ?? false,
      isRecipeEnabled: dto.isRecipeEnabled ?? false,
      preparationTime: dto.preparationTime ?? null,
      sortOrder: dto.sortOrder ?? 0,
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
      throw this.mapUniqueViolation(error, dto.slug, dto.sku);
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
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.shortDescription !== undefined && {
        shortDescription: dto.shortDescription,
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.skuSegment !== undefined && {
        skuSegment: dto.skuSegment ? normaliseSkuSegment(dto.skuSegment) : null,
      }),
      ...(dto.foodType !== undefined && { foodType: dto.foodType }),
      ...(dto.itemType !== undefined && { itemType: dto.itemType }),
      ...(dto.departmentType !== undefined && {
        departmentType: dto.departmentType,
      }),
      ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
      ...(dto.isTaxable !== undefined && { isTaxable: dto.isTaxable }),
      ...(dto.isDiscountable !== undefined && {
        isDiscountable: dto.isDiscountable,
      }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      ...(dto.isRecipeEnabled !== undefined && {
        isRecipeEnabled: dto.isRecipeEnabled,
      }),
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
      throw this.mapUniqueViolation(error, undefined, dto.sku);
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the order_items.food_id
    // RESTRICT FK (no entity yet, but the real table already enforces it).
    await this.foodsRepository.softDelete(id);
  }

  async listOutletOverrides(foodId: number): Promise<FoodOutlet[]> {
    await this.findOne(foodId);
    return this.foodOutletsRepository.find({ where: { foodId } });
  }

  async upsertOutletOverride(
    foodId: number,
    dto: UpsertFoodOutletDto,
  ): Promise<FoodOutlet> {
    await this.findOne(foodId);
    await this.outletsService.findOne(dto.outletId);

    let override = await this.foodOutletsRepository.findOne({
      where: { foodId, outletId: dto.outletId },
    });

    if (!override) {
      override = this.foodOutletsRepository.create({
        foodId,
        outletId: dto.outletId,
      });
    }
    override.price = dto.price ?? null;
    override.isAvailable = dto.isAvailable ?? true;

    return this.foodOutletsRepository.save(override);
  }

  async removeOutletOverride(foodId: number, outletId: number): Promise<void> {
    await this.findOne(foodId);
    await this.foodOutletsRepository.delete({ foodId, outletId });
  }

  async listAddonGroups(foodId: number): Promise<FoodAddonGroup[]> {
    await this.findOne(foodId);
    return this.foodAddonGroupsRepository.find({
      where: { foodId },
      relations: { addonGroup: true },
    });
  }

  async assignAddonGroup(
    foodId: number,
    dto: AssignAddonGroupDto,
  ): Promise<void> {
    const food = await this.findOne(foodId);
    await this.addonGroupsService.findOne(dto.addonGroupId);

    const existing = await this.foodAddonGroupsRepository.findOne({
      where: { foodId, addonGroupId: dto.addonGroupId },
    });
    if (existing) {
      return; // idempotent
    }

    await this.foodAddonGroupsRepository.save(
      this.foodAddonGroupsRepository.create({
        foodId,
        addonGroupId: dto.addonGroupId,
      }),
    );

    if (!food.hasAddons) {
      food.hasAddons = true;
      await this.foodsRepository.save(food);
    }
  }

  async unassignAddonGroup(
    foodId: number,
    addonGroupId: number,
  ): Promise<void> {
    await this.findOne(foodId);
    await this.foodAddonGroupsRepository.delete({ foodId, addonGroupId });
  }

  /** Marks a food as having variants — called by FoodVariantsService on create. */
  async markHasVariants(foodId: number): Promise<void> {
    await this.foodsRepository.update({ id: foodId }, { hasVariants: true });
  }

  /**
   * Resolves the price to charge for this food at a given outlet, checking
   * the Phase 4 per-outlet override first and falling back to base price.
   * Used by OrdersService to snapshot order_items.unit_price at add-time.
   */
  async resolvePriceForOutlet(
    foodId: number,
    outletId: number,
  ): Promise<{ food: Food; price: number }> {
    const food = await this.findOne(foodId);
    const override = await this.foodOutletsRepository.findOne({
      where: { foodId, outletId },
    });

    if (override && !override.isAvailable) {
      throw new BadRequestException(
        `Food ${foodId} is not available at outlet ${outletId}`,
      );
    }

    return { food, price: override?.price ?? food.basePrice };
  }

  // ------------------------------------------------------------------ recipes

  async listRecipes(foodId: number): Promise<FoodRecipe[]> {
    await this.findOne(foodId);
    return this.foodRecipesRepository.find({ where: { foodId } });
  }

  async addRecipe(
    foodId: number,
    dto: CreateFoodRecipeDto,
  ): Promise<FoodRecipe> {
    await this.findOne(foodId);
    await this.ingredientsService.findOne(dto.ingredientId);
    await this.unitsService.findOne(dto.unitId);

    const recipe = this.foodRecipesRepository.create({
      foodId,
      foodVariantId: dto.foodVariantId ?? null,
      ingredientId: dto.ingredientId,
      unitId: dto.unitId,
      quantity: dto.quantity,
      wastageQuantity: dto.wastageQuantity ?? 0,
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
        { foodId, foodVariantId: IsNull(), isActive: true },
        ...(foodVariantId !== null
          ? [{ foodId, foodVariantId, isActive: true }]
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
      where: { id: recipeId, foodId },
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
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { scopedWhere } from '../../common/tenant/tenant-scope';
import { TenantContext } from '../../common/tenant/tenant-context';
import { FoodCategory } from '../food-categories/entities/food-category.entity';
import { Food } from '../foods/entities/food.entity';
import { FoodRecipe } from '../foods/entities/food-recipe.entity';
import { FoodVariant } from '../food-variants/entities/food-variant.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { isTrackableIngredientType } from '../ingredient-categories/ingredient-category-type.util';
import { WarehouseIngredientStock } from '../inventory-stock/entities/warehouse-ingredient-stock.entity';
import { UnitsService } from '../units/units.service';
import { UnitConversion } from '../units/entities/unit-conversion.entity';
import { WarehousesService } from '../warehouses/warehouses.service';
import { SubVariant } from '../variants/entities/sub-variant.entity';
import { Variant } from '../variants/entities/variant.entity';

export interface MenuVersionResponse { version: string }

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Food) private readonly foods: Repository<Food>,
    @InjectRepository(FoodCategory) private readonly categories: Repository<FoodCategory>,
    @InjectRepository(FoodVariant) private readonly foodVariants: Repository<FoodVariant>,
    @InjectRepository(FoodRecipe) private readonly recipes: Repository<FoodRecipe>,
    @InjectRepository(UnitConversion) private readonly conversions: Repository<UnitConversion>,
    @InjectRepository(Ingredient) private readonly ingredients: Repository<Ingredient>,
    @InjectRepository(Variant) private readonly variants: Repository<Variant>,
    @InjectRepository(SubVariant) private readonly subVariants: Repository<SubVariant>,
    @InjectRepository(WarehouseIngredientStock) private readonly stocks: Repository<WarehouseIngredientStock>,
    private readonly warehousesService: WarehousesService,
    private readonly unitsService: UnitsService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getVersion(): Promise<MenuVersionResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await Promise.all([
      this.foods, this.categories, this.foodVariants, this.variants,
      this.subVariants,
      this.stocks,
      this.recipes,
      this.conversions,
      this.ingredients,
    ].map((repository) => {
      const qb = repository.createQueryBuilder('x').select('COUNT(*)', 'count').addSelect('MAX(x.updated_at)', 'updated');
      if (tenantId !== null) qb.andWhere('x.tenant_id = :tenantId', { tenantId });
      return qb.getRawOne<{ count: string; updated: string | null }>();
    }));
    return { version: rows.map((row) => `${row?.count ?? 0}:${row?.updated ?? ''}`).join('|') };
  }

  async getBootstrap(outletId: number, includeAvailableQuantity = true) {
    const [foods, categories, foodVariants, variants, subVariants, version] = await Promise.all([
      this.foods.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.categories.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.foodVariants.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.variants.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.subVariants.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.getVersion(),
    ]);
    const availability = await this.getInventoryAvailability(outletId, foods, foodVariants);
    return {
      version: version.version,
      foods,
      categories,
      foodVariants: foodVariants.map((variant) => {
        const availableQuantity = availability.get(variant.id) ?? null;
        return {
          ...variant,
          inventoryAvailable: availableQuantity === null || availableQuantity > 0,
          ...(includeAvailableQuantity ? { availableQuantity } : {}),
        };
      }),
      variants,
      subVariants,
    };
  }

  /**
   * Per food ITEM (variant), not per food — each variant of a food (e.g. a
   * Large vs a Small drink) can be linked to a different ingredient and so
   * can be in-stock/out-of-stock independently of its siblings.
   */
  private async getInventoryAvailability(
    outletId: number,
    foods: Food[],
    foodVariants: FoodVariant[],
  ): Promise<Map<number, number | null>> {
    const result = new Map<number, number | null>();
    const foodById = new Map(foods.map((food) => [food.id, food]));
    const trackedVariants = foodVariants.filter((variant) =>
      variant.inventoryIngredientId !== null || foodById.get(variant.foodId)?.itemType === 'kitchen',
    );
    if (trackedVariants.length === 0) return result;

    let warehouse;
    try { warehouse = await this.warehousesService.findDefaultForOutlet(outletId); } catch {
      for (const variant of trackedVariants) result.set(variant.id, 0);
      return result;
    }

    const [stocks, recipes] = await Promise.all([
      this.stocks.find({ where: scopedWhere(this.tenantContext, { warehouseId: warehouse.id }) }),
      this.recipes.find({
        where: scopedWhere(this.tenantContext, {
          foodId: In([...new Set(trackedVariants.map((variant) => variant.foodId))]),
          isActive: true,
        }),
      }),
    ]);
    const stockByIngredient = new Map(stocks.map((stock) => [
      stock.ingredientId,
      Math.max(0, Number(stock.quantity) - Number(stock.reservedQuantity)),
    ]));
    const ingredientIds = [...new Set([
      ...trackedVariants.map((variant) => variant.inventoryIngredientId).filter((id): id is number => id !== null),
      ...recipes.map((recipe) => recipe.ingredientId),
    ])];
    const ingredients = ingredientIds.length
      ? await this.ingredients.find({
          where: scopedWhere(this.tenantContext, { id: In(ingredientIds) }),
          relations: { category: true },
        })
      : [];
    const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const recipesByFood = new Map<number, FoodRecipe[]>();
    for (const recipe of recipes) {
      const list = recipesByFood.get(recipe.foodId) ?? [];
      list.push(recipe);
      recipesByFood.set(recipe.foodId, list);
    }

    const recipesByVariant = new Map<number, FoodRecipe[]>();
    for (const variant of trackedVariants) {
      const food = foodById.get(variant.foodId);
      let rows: FoodRecipe[] = [];
      if (food?.itemType === 'kitchen') {
        const byIngredient = new Map<number, FoodRecipe>();
        for (const recipe of recipesByFood.get(variant.foodId) ?? []) {
          if (recipe.foodVariantId !== null && recipe.foodVariantId !== variant.id) continue;
          const current = byIngredient.get(recipe.ingredientId);
          if (!current || (current.foodVariantId === null && recipe.foodVariantId !== null)) {
            byIngredient.set(recipe.ingredientId, recipe);
          }
        }
        rows = [...byIngredient.values()];
      } else if (variant.inventoryIngredientId !== null) {
        const linkedId = variant.inventoryIngredientId;
        const matching = (recipesByFood.get(variant.foodId) ?? []).filter(
          (recipe) => recipe.ingredientId === linkedId &&
            (recipe.foodVariantId === null || recipe.foodVariantId === variant.id),
        );
        const specific = matching.find((recipe) => recipe.foodVariantId === variant.id);
        const general = matching.find((recipe) => recipe.foodVariantId === null);
        rows = specific ? [specific] : general ? [general] : [];
        if (rows.length === 0) {
          const ingredient = ingredientById.get(linkedId);
          result.set(
            variant.id,
            ingredient && isTrackableIngredientType(ingredient.category.type)
              ? Math.floor(stockByIngredient.get(linkedId) ?? 0)
              : 0,
          );
          continue;
        }
      }
      recipesByVariant.set(variant.id, rows);
    }

    const conversionPairs = [...recipesByVariant.values()].flatMap((rows) => rows.flatMap((recipe) => {
      const ingredient = ingredientById.get(recipe.ingredientId);
      return ingredient && isTrackableIngredientType(ingredient.category.type)
        ? [{ fromUnitId: recipe.unitId, toUnitId: ingredient.baseUnitId }]
        : [];
    }));
    const conversions = await this.unitsService.findConversionMultipliers(conversionPairs);

    for (const variant of trackedVariants) {
      const rows = recipesByVariant.get(variant.id) ?? [];
      const requiredByIngredient = new Map<number, number>();
      for (const recipe of rows) {
        const ingredient = ingredientById.get(recipe.ingredientId);
        if (!ingredient || !isTrackableIngredientType(ingredient.category.type)) continue;
        const key = `${recipe.unitId}:${ingredient.baseUnitId}`;
        const multiplier = recipe.unitId === ingredient.baseUnitId ? 1 : conversions.get(key);
        const required = multiplier === undefined
          ? Number.POSITIVE_INFINITY
          : round4((recipe.quantity + recipe.wastageQuantity) * multiplier);
        requiredByIngredient.set(
          recipe.ingredientId,
          round4((requiredByIngredient.get(recipe.ingredientId) ?? 0) + required),
        );
      }

      if (requiredByIngredient.size === 0) {
        result.set(variant.id, foodById.get(variant.foodId)?.itemType === 'kitchen' || variant.inventoryIngredientId === null ? null : 0);
        continue;
      }
      const capacities = [...requiredByIngredient].map(([ingredientId, required]) =>
        required > 0 ? Math.floor((stockByIngredient.get(ingredientId) ?? 0) / required + 1e-9) : Number.POSITIVE_INFINITY,
      );
      result.set(variant.id, Math.min(...capacities));
    }
    return result;
  }
}

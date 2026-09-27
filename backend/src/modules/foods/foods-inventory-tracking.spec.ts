import type { DataSource, Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import { FoodsService } from './foods.service';
import type { Food } from './entities/food.entity';
import type { FoodVariant } from '../food-variants/entities/food-variant.entity';
import type { IngredientsService } from '../ingredients/ingredients.service';
import { TenantContext } from '../../common/tenant/tenant-context';

interface FakeIngredient {
  id: number;
  code: string;
  name: string;
}

function buildService(foods: Partial<Food>[], variants: Partial<FoodVariant>[], ingredients: FakeIngredient[] = []) {
  let nextIngredientId = 900;
  const foodsRepository = { find: jest.fn(async () => foods) } as unknown as Repository<Food>;
  const foodVariantsRepository = {
    find: jest.fn(async ({ where }: { where: { foodId: number; isActive: boolean } }) =>
      variants.filter((variant) => variant.foodId === where.foodId && variant.isActive === where.isActive),
    ),
    update: jest.fn(async (ids: number[], patch: Partial<FoodVariant>) => {
      for (const variant of variants) if (ids.includes(variant.id!)) Object.assign(variant, patch);
    }),
  } as unknown as Repository<FoodVariant>;
  const ingredientsService = {
    assertCategoryTrackable: jest.fn(async () => undefined),
    releaseDeletedIdentifiers: jest.fn(async () => undefined),
    findByCode: jest.fn(async (code: string) => ingredients.find((ingredient) => ingredient.code === code) ?? null),
    findByIds: jest.fn(async (ids: number[]) => ingredients.filter((ingredient) => ids.includes(ingredient.id))),
    create: jest.fn(async (dto: { code: string; name: string }) => {
      const ingredient = { id: nextIngredientId++, code: dto.code, name: dto.name };
      ingredients.push(ingredient);
      return ingredient;
    }),
  };

  const service = new FoodsService(
    foodsRepository,
    {} as never,
    {} as never,
    foodVariantsRepository,
    {} as never,
    {} as never,
    {} as never,
    {} as Cache,
    {} as never,
    {} as never,
    ingredientsService as unknown as IngredientsService,
    {} as never,
    {} as never,
    new TenantContext(),
    {} as DataSource,
  );
  return { service, ingredients, ingredientsService };
}

const beer = { id: 1, name: 'Beer', itemType: 'ready_made' } as Food;
const coke = { id: 2, name: 'Coke', itemType: 'ready_made' } as Food;
const momo = { id: 3, name: 'Momo', itemType: 'kitchen' } as Food;
const item = (id: number, foodId: number, name: string, inventoryIngredientId: number | null = null) =>
  ({ id, foodId, name, inventoryIngredientId, isActive: true }) as FoodVariant;

const newItemDefaults = { outletId: 5, ingredientCategoryId: 7, baseUnitId: 8 };

describe('FoodsService.setInventoryTracking', () => {
  it('tracks a single-size food like Beer on one stock item named after the food', async () => {
    const variants = [item(10, 1, 'Beer')];
    const { service, ingredients } = buildService([beer], variants);

    const result = await service.setInventoryTracking({
      ...newItemDefaults,
      foods: [{ foodId: 1, shareStock: true, trackedFoodVariantIds: [10] }],
    });

    expect(result).toEqual({ updated: 1, created: 1, errors: [] });
    expect(ingredients).toEqual([{ id: 900, code: 'FOOD-1', name: 'Beer' }]);
    expect(variants[0].inventoryIngredientId).toBe(900);
  });

  it('gives each Coke size its own stock item when tracked per size', async () => {
    const variants = [item(20, 2, '1L'), item(21, 2, 'Coke 1.5L'), item(22, 2, '500ml')];
    const { service, ingredients } = buildService([coke], variants);

    await service.setInventoryTracking({
      ...newItemDefaults,
      foods: [{ foodId: 2, shareStock: false, trackedFoodVariantIds: [20, 21] }],
    });

    expect(ingredients.map(({ code, name }) => [code, name])).toEqual([
      ['FOOD-ITEM-20', 'Coke 1L'],
      ['FOOD-ITEM-21', 'Coke 1.5L'],
    ]);
    expect(variants.map((variant) => variant.inventoryIngredientId)).toEqual([900, 901, null]);
  });

  it('moves per-size items onto one shared stock item when switched to sharing', async () => {
    const variants = [item(20, 2, '1L', 50), item(21, 2, '1.5L', 51)];
    const { service } = buildService([coke], variants, [
      { id: 50, code: 'FOOD-ITEM-20', name: 'Coke 1L' },
      { id: 51, code: 'FOOD-ITEM-21', name: 'Coke 1.5L' },
    ]);

    await service.setInventoryTracking({
      ...newItemDefaults,
      foods: [{ foodId: 2, shareStock: true, trackedFoodVariantIds: [20, 21] }],
    });

    expect(variants.map((variant) => variant.inventoryIngredientId)).toEqual([900, 900]);
  });

  it('keeps a hand-made shared stock item when a size joins it', async () => {
    const variants = [item(20, 2, '1L', 60), item(21, 2, '1.5L', 60), item(22, 2, '500ml')];
    const { service, ingredientsService } = buildService([coke], variants, [{ id: 60, code: 'COKE-CRATE', name: 'Coke' }]);

    await service.setInventoryTracking({
      ...newItemDefaults,
      foods: [{ foodId: 2, shareStock: true, trackedFoodVariantIds: [20, 21, 22] }],
    });

    expect(ingredientsService.create).not.toHaveBeenCalled();
    expect(variants.map((variant) => variant.inventoryIngredientId)).toEqual([60, 60, 60]);
  });

  it('reuses the same stock item when an untracked food is tracked again', async () => {
    const variants = [item(10, 1, 'Beer', 900)];
    const { service, ingredientsService } = buildService([beer], variants, [{ id: 900, code: 'FOOD-1', name: 'Beer' }]);

    await service.setInventoryTracking({ ...newItemDefaults, foods: [{ foodId: 1, shareStock: true, trackedFoodVariantIds: [] }] });
    expect(variants[0].inventoryIngredientId).toBeNull();

    await service.setInventoryTracking({ ...newItemDefaults, foods: [{ foodId: 1, shareStock: true, trackedFoodVariantIds: [10] }] });
    expect(variants[0].inventoryIngredientId).toBe(900);
    expect(ingredientsService.create).not.toHaveBeenCalled();
  });

  it('treats a link to a deleted stock item as untracked', async () => {
    const variants = [item(10, 1, 'Beer', 404)];
    const { service } = buildService([beer], variants);

    const result = await service.setInventoryTracking({
      ...newItemDefaults,
      foods: [{ foodId: 1, shareStock: true, trackedFoodVariantIds: [10] }],
    });

    expect(result.created).toBe(1);
    expect(variants[0].inventoryIngredientId).toBe(900);
  });

  it('reports kitchen dishes, foreign sizes and missing new-item settings per food without stopping the batch', async () => {
    const variants = [item(10, 1, 'Beer'), item(20, 2, '1L'), item(30, 3, 'Plate')];
    const { service } = buildService([beer, coke, momo], variants);

    const result = await service.setInventoryTracking({
      outletId: 5,
      foods: [
        { foodId: 3, shareStock: true, trackedFoodVariantIds: [30] },
        { foodId: 2, shareStock: false, trackedFoodVariantIds: [10] },
        { foodId: 1, shareStock: true, trackedFoodVariantIds: [10] },
      ],
    });

    expect(result.updated).toBe(0);
    expect(result.errors).toEqual([
      'Momo: kitchen dishes are stocked through their recipe',
      'Coke: food item 10 is not an active item of this food',
      'Beer: choose a stock category and counting unit for new stock items',
    ]);
  });
});

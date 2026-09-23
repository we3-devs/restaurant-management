import type { EntityManager, Repository } from 'typeorm';
import { IngredientsImporter } from './ingredients-importer';
import type { Ingredient } from '../entities/ingredient.entity';
import type { IngredientCategory } from '../../ingredient-categories/entities/ingredient-category.entity';
import type { Outlet } from '../../outlets/entities/outlet.entity';
import type { Unit } from '../../units/entities/unit.entity';
import type { Warehouse } from '../../warehouses/entities/warehouse.entity';
import type { WarehouseIngredientStocksService } from '../../inventory-stock/warehouse-ingredient-stocks.service';

function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

const DEFAULT_OUTLETS = [{ id: 1, name: 'Main Outlet' }];
const DEFAULT_WAREHOUSES = [{ id: 7, name: 'Main Store', outletId: 1 }];

/** Row fields every commitRows fixture needs; spread and override per test. */
const NO_OPENING_STOCK = { warehouse: '', warehouseId: null, openingQuantity: null, unitCost: null };

function buildRepos(opts: {
  existingIngredients?: { id: number; code: string; outletId: number }[];
  categories?: { id: number; name: string; type?: string }[];
  units?: { id: number; name: string }[];
  outlets?: { id: number; name: string }[];
  warehouses?: { id: number; name: string; outletId: number }[];
  /** An existing stock row makes postOpeningStock no-op — the re-import guard. */
  existingStock?: { warehouseId: number; ingredientId: number } | null;
} = {}) {
  let nextId = (opts.existingIngredients?.length ?? 0) + 1;
  const ingredientsRepository = {
    find: async () => opts.existingIngredients ?? [],
    create: (data: Partial<Ingredient>) => data as Ingredient,
    save: jest.fn(async (i: Ingredient) => ({ ...i, id: i.id ?? nextId++ }) as Ingredient),
    update: jest.fn(async () => undefined),
  } as unknown as Repository<Ingredient>;
  const categoriesRepository = { find: async () => opts.categories ?? [] } as unknown as Repository<IngredientCategory>;
  const unitsRepository = { find: async () => opts.units ?? [] } as unknown as Repository<Unit>;
  const outletsRepository = { find: async () => opts.outlets ?? DEFAULT_OUTLETS } as unknown as Repository<Outlet>;
  const warehousesRepository = { find: async () => opts.warehouses ?? DEFAULT_WAREHOUSES } as unknown as Repository<Warehouse>;
  const stocksService = { applyMovement: jest.fn(async () => undefined) } as unknown as WarehouseIngredientStocksService;
  const stockRepo = {
    findOne: jest.fn(async () => opts.existingStock ?? null),
  };
  const stockInRepo = {
    create: (data: Record<string, unknown>) => data,
    save: jest.fn(async (d: Record<string, unknown>) => ({ ...d, id: 99 })),
  };
  const stockInItemRepo = {
    create: (data: Record<string, unknown>) => data,
    save: jest.fn(async (d: Record<string, unknown>) => ({ ...d, id: 1 })),
  };
  return { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService, stockRepo, stockInRepo, stockInItemRepo };
}

/**
 * commitRows pulls three different repositories off the manager, so the stub
 * has to route by entity rather than return one repo for everything.
 */
function repoFor(
  managerRepo: unknown,
  stockRepo: unknown,
  stockInRepo: unknown,
  stockInItemRepo: unknown,
) {
  return (entity: { name: string }) => {
    if (entity.name === 'WarehouseIngredientStock') return stockRepo;
    if (entity.name === 'IngredientStockIn') return stockInRepo;
    if (entity.name === 'IngredientStockInItem') return stockInItemRepo;
    return managerRepo;
  };
}

describe('IngredientsImporter', () => {
  describe('validateRows', () => {
    it('flags a missing category with an exact-match error, never auto-creating one', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.errors).toEqual(['Category "Vegetables" not found — expected an existing ingredient category']);
    });

    it('flags a missing unit with an exact-match error', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 1, name: 'Vegetables', type: 'consumable' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Killo' }]));

      expect(row.errors).toEqual(['Unit "Killo" not found — expected an existing unit']);
    });

    it('flags a missing outlet with an exact-match error', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 1, name: 'Vegetables', type: 'consumable' }],
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Nowhere', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.errors).toEqual(['Outlet "Nowhere" not found — expected an existing outlet']);
    });

    it('passes a valid row and resolves outlet/category/unit ids', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 5, name: 'Vegetables' }],
        units: [{ id: 9, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.errors).toEqual([]);
      expect(row.outletId).toBe(1);
      expect(row.categoryId).toBe(5);
      expect(row.unitId).toBe(9);
      expect(row.existingId).toBeNull();
    });

    it('resolves an existing ingredient by outlet+code for the upsert path', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        existingIngredients: [{ id: 42, code: 'ING-1', outletId: 1 }],
        categories: [{ id: 5, name: 'Vegetables' }],
        units: [{ id: 9, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ing-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.existingId).toBe(42);
    });

    it('does not match an existing ingredient with the same code under a different outlet', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        existingIngredients: [{ id: 42, code: 'ING-1', outletId: 2 }],
        categories: [{ id: 5, name: 'Vegetables' }],
        units: [{ id: 9, name: 'Kilogram' }],
        outlets: [{ id: 1, name: 'Main Outlet' }, { id: 2, name: 'Other Outlet' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ing-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.existingId).toBeNull();
    });

    it('rejects a warehouse that belongs to another outlet', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 1, name: 'Vegetables', type: 'consumable' }],
        units: [{ id: 1, name: 'Kilogram' }],
        warehouses: [{ id: 7, name: 'Main Store', outletId: 2 }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram', warehouse: 'Main Store', openingQuantity: '10' }]));

      expect(row.errors).toEqual(['Warehouse "Main Store" not found under outlet "Main Outlet"']);
    });

    it('rejects a half-filled opening balance in either direction', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 1, name: 'Vegetables', type: 'consumable' }],
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);
      const base = { outlet: 'Main Outlet', name: 'Tomato', category: 'Vegetables', unit: 'Kilogram' };

      const [warehouseOnly, quantityOnly] = await importer.validateRows(
        wrap([
          { ...base, code: 'ING-1', warehouse: 'Main Store' },
          { ...base, code: 'ING-2', openingQuantity: '10' },
        ]),
      );

      expect(warehouseOnly.errors).toEqual(['openingQuantity is required when warehouse is given']);
      expect(quantityOnly.errors).toEqual(['warehouse is required when openingQuantity is given']);
    });

    it('leaves both opening-stock fields null when neither is supplied — the reference-data-only path', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 1, name: 'Vegetables', type: 'consumable' }],
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.errors).toEqual([]);
      expect(row.warehouseId).toBeNull();
      expect(row.openingQuantity).toBeNull();
    });
  });


    it('rejects an opening balance for a category type that carries no stock', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 1, name: 'Meat', type: 'raw_material' }],
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Pork', code: 'ING-1', category: 'Meat', unit: 'Kilogram', warehouse: 'Main Store', openingQuantity: '10' }]));

      expect(row.errors).toEqual([
        'Category "Meat" (type: raw_material) does not support stock tracking — leave warehouse and openingQuantity blank',
      ]);
    });

    it('still imports an untracked ingredient when no opening balance is asked for', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos({
        categories: [{ id: 1, name: 'Meat', type: 'raw_material' }],
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Pork', code: 'ING-1', category: 'Meat', unit: 'Kilogram' }]));

      expect(row.errors).toEqual([]);
    });

  describe('commitRows', () => {
    it('creates a new ingredient when there is no existing match', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos();
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);
      const { ingredientsRepository: managerRepo } = buildRepos();
      // commitRows wraps each row in a SAVEPOINT, so the manager has to
      // answer .query as well as .getRepository.
      const manager = { getRepository: () => managerRepo, query: jest.fn(async () => undefined) } as unknown as EntityManager;

      const result = await importer.commitRows(
        [{ rowNumber: 2, code: 'ING-1', name: 'Tomato', outlet: 'Main Outlet', outletId: 1, category: 'Vegetables', categoryId: 5, unit: 'Kilogram', unitId: 9, ...NO_OPENING_STOCK, existingId: null, errors: [] }],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(managerRepo.save).toHaveBeenCalledTimes(1);
      expect(managerRepo.update).not.toHaveBeenCalled();
    });

    it('updates the existing ingredient (via manager.update) when existingId is set — the upsert path', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos();
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);
      const { ingredientsRepository: managerRepo } = buildRepos();
      // commitRows wraps each row in a SAVEPOINT, so the manager has to
      // answer .query as well as .getRepository.
      const manager = { getRepository: () => managerRepo, query: jest.fn(async () => undefined) } as unknown as EntityManager;

      const result = await importer.commitRows(
        [{ rowNumber: 2, code: 'ING-1', name: 'Tomato v2', outlet: 'Main Outlet', outletId: 1, category: 'Vegetables', categoryId: 5, unit: 'Kilogram', unitId: 9, ...NO_OPENING_STOCK, existingId: 42, errors: [] }],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(result.succeeded).toEqual([{ rowNumber: 2, entityId: 42 }]);
      expect(managerRepo.update).toHaveBeenCalledWith({ id: 42 }, expect.objectContaining({ name: 'Tomato v2' }));
      expect(managerRepo.save).not.toHaveBeenCalled();
    });

    it('posts opening stock through the ledger, materialising the inventory item', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos();
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);
      const { ingredientsRepository: managerRepo, stockRepo, stockInRepo, stockInItemRepo } = buildRepos();
      const manager = { getRepository: repoFor(managerRepo, stockRepo, stockInRepo, stockInItemRepo), query: jest.fn(async () => undefined) } as unknown as EntityManager;

      const result = await importer.commitRows(
        [{ rowNumber: 2, code: 'ING-1', name: 'Tomato', outlet: 'Main Outlet', outletId: 1, category: 'Vegetables', categoryId: 5, unit: 'Kilogram', unitId: 9, warehouse: 'Main Store', warehouseId: 7, openingQuantity: 25, unitCost: 1.5, existingId: null, errors: [] }],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(stockInRepo.save).toHaveBeenCalledTimes(1);
      expect(stockInItemRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 25, unitCost: 1.5, totalCost: 37.5 }));
      expect(stocksService.applyMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: 7,
          quantityDelta: 25,
          unitCost: 1.5,
          transactionType: 'opening_stock',
          referenceType: 'stock_in',
          referenceId: 99,
        }),
      );
    });

    it('never re-posts an opening balance for a pair that already holds stock', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService } = buildRepos();
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository, warehousesRepository, stocksService);
      const { ingredientsRepository: managerRepo, stockRepo, stockInRepo, stockInItemRepo } = buildRepos({ existingStock: { warehouseId: 7, ingredientId: 42 } });
      const manager = { getRepository: repoFor(managerRepo, stockRepo, stockInRepo, stockInItemRepo), query: jest.fn(async () => undefined) } as unknown as EntityManager;

      const result = await importer.commitRows(
        [{ rowNumber: 2, code: 'ING-1', name: 'Tomato v2', outlet: 'Main Outlet', outletId: 1, category: 'Vegetables', categoryId: 5, unit: 'Kilogram', unitId: 9, warehouse: 'Main Store', warehouseId: 7, openingQuantity: 25, unitCost: 1.5, existingId: 42, errors: [] }],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(managerRepo.update).toHaveBeenCalled();
      expect(stockInRepo.save).not.toHaveBeenCalled();
      expect(stocksService.applyMovement).not.toHaveBeenCalled();
    });
  });
});

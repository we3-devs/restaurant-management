import type { EntityManager, Repository } from 'typeorm';
import { IngredientsImporter } from './ingredients-importer';
import type { Ingredient } from '../entities/ingredient.entity';
import type { IngredientCategory } from '../../ingredient-categories/entities/ingredient-category.entity';
import type { Outlet } from '../../outlets/entities/outlet.entity';
import type { Unit } from '../../units/entities/unit.entity';

function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

const DEFAULT_OUTLETS = [{ id: 1, name: 'Main Outlet' }];

function buildRepos(opts: {
  existingIngredients?: { id: number; code: string; outletId: number }[];
  categories?: { id: number; name: string }[];
  units?: { id: number; name: string }[];
  outlets?: { id: number; name: string }[];
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
  return { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository };
}

describe('IngredientsImporter', () => {
  describe('validateRows', () => {
    it('flags a missing category with an exact-match error, never auto-creating one', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos({
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.errors).toEqual(['Category "Vegetables" not found — expected an existing ingredient category']);
    });

    it('flags a missing unit with an exact-match error', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos({
        categories: [{ id: 1, name: 'Vegetables' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Killo' }]));

      expect(row.errors).toEqual(['Unit "Killo" not found — expected an existing unit']);
    });

    it('flags a missing outlet with an exact-match error', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos({
        categories: [{ id: 1, name: 'Vegetables' }],
        units: [{ id: 1, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Nowhere', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.errors).toEqual(['Outlet "Nowhere" not found — expected an existing outlet']);
    });

    it('passes a valid row and resolves outlet/category/unit ids', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos({
        categories: [{ id: 5, name: 'Vegetables' }],
        units: [{ id: 9, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ING-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.errors).toEqual([]);
      expect(row.outletId).toBe(1);
      expect(row.categoryId).toBe(5);
      expect(row.unitId).toBe(9);
      expect(row.existingId).toBeNull();
    });

    it('resolves an existing ingredient by outlet+code for the upsert path', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos({
        existingIngredients: [{ id: 42, code: 'ING-1', outletId: 1 }],
        categories: [{ id: 5, name: 'Vegetables' }],
        units: [{ id: 9, name: 'Kilogram' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ing-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.existingId).toBe(42);
    });

    it('does not match an existing ingredient with the same code under a different outlet', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos({
        existingIngredients: [{ id: 42, code: 'ING-1', outletId: 2 }],
        categories: [{ id: 5, name: 'Vegetables' }],
        units: [{ id: 9, name: 'Kilogram' }],
        outlets: [{ id: 1, name: 'Main Outlet' }, { id: 2, name: 'Other Outlet' }],
      });
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ outlet: 'Main Outlet', name: 'Tomato', code: 'ing-1', category: 'Vegetables', unit: 'Kilogram' }]));

      expect(row.existingId).toBeNull();
    });
  });

  describe('commitRows', () => {
    it('creates a new ingredient when there is no existing match', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos();
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);
      const { ingredientsRepository: managerRepo } = buildRepos();
      const manager = { getRepository: () => managerRepo } as unknown as EntityManager;

      const result = await importer.commitRows(
        [{ rowNumber: 2, code: 'ING-1', name: 'Tomato', outlet: 'Main Outlet', outletId: 1, category: 'Vegetables', categoryId: 5, unit: 'Kilogram', unitId: 9, existingId: null, errors: [] }],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(managerRepo.save).toHaveBeenCalledTimes(1);
      expect(managerRepo.update).not.toHaveBeenCalled();
    });

    it('updates the existing ingredient (via manager.update) when existingId is set — the upsert path', async () => {
      const { ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository } = buildRepos();
      const importer = new IngredientsImporter(ingredientsRepository, categoriesRepository, unitsRepository, outletsRepository);
      const { ingredientsRepository: managerRepo } = buildRepos();
      const manager = { getRepository: () => managerRepo } as unknown as EntityManager;

      const result = await importer.commitRows(
        [{ rowNumber: 2, code: 'ING-1', name: 'Tomato v2', outlet: 'Main Outlet', outletId: 1, category: 'Vegetables', categoryId: 5, unit: 'Kilogram', unitId: 9, existingId: 42, errors: [] }],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(result.succeeded).toEqual([{ rowNumber: 2, entityId: 42 }]);
      expect(managerRepo.update).toHaveBeenCalledWith(42, expect.objectContaining({ name: 'Tomato v2' }));
      expect(managerRepo.save).not.toHaveBeenCalled();
    });
  });
});

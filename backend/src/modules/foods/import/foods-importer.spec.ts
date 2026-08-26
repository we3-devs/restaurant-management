import type { EntityManager, Repository } from 'typeorm';
import { FoodsImporter } from './foods-importer';
import type { Food } from '../entities/food.entity';
import type { FoodCategory } from '../../food-categories/entities/food-category.entity';
import type { SkuCompositionService } from '../sku-composition.service';

function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

function buildRepos(opts: {
  existingFoods?: { slug: string; sku: string | null }[];
  categories?: { id: number; name: string }[];
} = {}) {
  let nextId = 1;
  const foodsRepository = {
    find: async () => opts.existingFoods ?? [],
    create: (data: Partial<Food>) => data as Food,
    save: jest.fn(async (f: Food) => ({ ...f, id: f.id ?? nextId++ }) as Food),
  } as unknown as Repository<Food>;
  const categoriesRepository = { find: async () => opts.categories ?? [] } as unknown as Repository<FoodCategory>;
  const skuCompositionService = { recomposeFoodTree: jest.fn(async () => undefined) } as unknown as SkuCompositionService;
  return { foodsRepository, categoriesRepository, skuCompositionService };
}

describe('FoodsImporter', () => {
  describe('rowFilter', () => {
    it('drops trashed WordPress posts', () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos();
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);
      expect(importer.rowFilter({ postStatus: 'trash' })).toBe(false);
      expect(importer.rowFilter({ postStatus: 'publish' })).toBe(true);
    });

    it('drops WooCommerce variation child rows (non-zero postParent)', () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos();
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);
      expect(importer.rowFilter({ postParent: '42' })).toBe(false);
      expect(importer.rowFilter({ postParent: '0' })).toBe(true);
      expect(importer.rowFilter({})).toBe(true);
    });
  });

  describe('validateRows', () => {
    it('rejects a slug that already exists — create only, never treated as an update', async () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos({
        existingFoods: [{ slug: 'margherita-pizza', sku: null }],
      });
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);

      const [row] = await importer.validateRows(wrap([{ name: 'Margherita Pizza', slug: 'margherita-pizza' }]));

      expect(row.errors).toContain('Slug "margherita-pizza" is already in use');
    });

    it('derives a slug from the name when none is given', async () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos();
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);

      const [row] = await importer.validateRows(wrap([{ name: 'Margherita Pizza' }]));

      expect(row.slug).toBe('margherita-pizza');
      expect(row.errors).toEqual([]);
    });

    it('does not error on an unmatched category — matches the pre-migration behavior of importing without one', async () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos();
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);

      const [row] = await importer.validateRows(wrap([{ name: 'Mystery Dish', foodCategory: 'Nonexistent' }]));

      expect(row.errors).toEqual([]);
      expect(row.foodCategoryId).toBeNull();
    });

    it('takes only the first term from a WooCommerce category path/list', async () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos({
        categories: [{ id: 7, name: 'Drinks' }],
      });
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);

      const [row] = await importer.validateRows(wrap([{ name: 'Cola', foodCategory: 'Drinks > Cold Drinks' }]));

      expect(row.foodCategoryId).toBe(7);
    });

    it('extracts only the first URL from a pipe/comma/space-separated image list', async () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos();
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);

      const [row] = await importer.validateRows(wrap([{ name: 'Cola', imageUrl: 'a.jpg|b.jpg,c.jpg' }]));

      expect(row.imageUrl).toBe('a.jpg');
    });

    it('preserves the caller-supplied rowNumber for a chunk that does not start at row 2', async () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos();
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);

      const [row] = await importer.validateRows(wrap([{ name: 'Cola' }], 50));

      expect(row.rowNumber).toBe(50);
    });
  });

  describe('commitRows', () => {
    it('creates the food and recomposes its SKU tree through the same transactional manager', async () => {
      const { foodsRepository, categoriesRepository, skuCompositionService } = buildRepos();
      const importer = new FoodsImporter(foodsRepository, categoriesRepository, skuCompositionService);
      const { foodsRepository: managerRepo } = buildRepos();
      const manager = { getRepository: () => managerRepo } as unknown as EntityManager;

      const result = await importer.commitRows(
        [
          {
            rowNumber: 2,
            name: 'Margherita Pizza',
            slug: 'margherita-pizza',
            sku: null,
            shortDescription: null,
            imageUrl: null,
            foodCategory: null,
            foodCategoryId: null,
            itemType: 'food',
            departmentType: null,
            foodType: null,
            basePrice: 450,
            errors: [],
          },
        ],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(managerRepo.save).toHaveBeenCalledTimes(1);
      expect(skuCompositionService.recomposeFoodTree).toHaveBeenCalledWith(result.succeeded[0]!.entityId, manager);
    });
  });
});

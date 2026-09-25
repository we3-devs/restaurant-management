import type { EntityManager, Repository } from 'typeorm';
import { FoodsImporter } from './foods-importer';
import type { Food } from '../entities/food.entity';
import type { FoodCategory } from '../../food-categories/entities/food-category.entity';
import type { FoodVariant } from '../../food-variants/entities/food-variant.entity';
import type { Variant } from '../../variants/entities/variant.entity';
import type { SubVariant } from '../../variants/entities/sub-variant.entity';
import type { SkuCompositionService } from '../sku-composition.service';

function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

function buildRepos(opts: {
  existingFoods?: { slug: string }[];
  categories?: { id: number; name: string }[];
  variants?: { id: number; name: string }[];
  subVariants?: { id: number; name: string }[];
} = {}) {
  let nextId = 1;
  const foodsRepository = {
    find: async () => opts.existingFoods ?? [],
    create: (data: Partial<Food>) => data as Food,
    save: jest.fn(async (f: Food) => ({ ...f, id: f.id ?? nextId++ }) as Food),
  } as unknown as Repository<Food>;
  const categoriesRepository = { find: async () => opts.categories ?? [] } as unknown as Repository<FoodCategory>;
  const foodVariantsRepository = {
    create: (data: Partial<FoodVariant>) => data as FoodVariant,
    save: jest.fn(async (fv: FoodVariant) => ({ ...fv, id: nextId++ }) as FoodVariant),
    findOne: jest.fn(async () => null),
    update: jest.fn(async () => undefined),
  } as unknown as Repository<FoodVariant>;
  const variantsRepository = { find: async () => opts.variants ?? [] } as unknown as Repository<Variant>;
  const subVariantsRepository = { find: async () => opts.subVariants ?? [] } as unknown as Repository<SubVariant>;
  const skuCompositionService = { recomposeFoodTree: jest.fn(async () => undefined) } as unknown as SkuCompositionService;
  return { foodsRepository, categoriesRepository, foodVariantsRepository, variantsRepository, subVariantsRepository, skuCompositionService };
}

function buildImporter(opts: Parameters<typeof buildRepos>[0] = {}) {
  const repos = buildRepos(opts);
  const importer = new FoodsImporter(
    repos.foodsRepository,
    repos.categoriesRepository,
    repos.foodVariantsRepository,
    repos.variantsRepository,
    repos.subVariantsRepository,
    repos.skuCompositionService,
  );
  return { importer, ...repos };
}

describe('FoodsImporter', () => {
  describe('rowFilter', () => {
    it('drops trashed WordPress posts', () => {
      const { importer } = buildImporter();
      expect(importer.rowFilter({ postStatus: 'trash' })).toBe(false);
      expect(importer.rowFilter({ postStatus: 'publish' })).toBe(true);
    });

    it('drops WooCommerce variation child rows (non-zero postParent)', () => {
      const { importer } = buildImporter();
      expect(importer.rowFilter({ postParent: '42' })).toBe(false);
      expect(importer.rowFilter({ postParent: '0' })).toBe(true);
      expect(importer.rowFilter({})).toBe(true);
    });
  });

  describe('validateRows', () => {
    it('rejects a slug that already exists — create only, never treated as an update', async () => {
      const { importer } = buildImporter({ existingFoods: [{ slug: 'margherita-pizza' }] });
      const [row] = await importer.validateRows(wrap([{ name: 'Margherita Pizza', slug: 'margherita-pizza' }]));
      expect(row.errors).toContain('Slug "margherita-pizza" is already in use');
    });

    it('derives a slug from the name when none is given', async () => {
      const { importer } = buildImporter();
      const [row] = await importer.validateRows(wrap([{ name: 'Margherita Pizza' }]));
      expect(row.slug).toBe('margherita-pizza');
      expect(row.errors).toEqual([]);
    });

    it('accepts slugs that include dots', async () => {
      const { importer } = buildImporter();
      const [row] = await importer.validateRows(wrap([{ name: 'Special Combo', slug: 'special.combo' }]));
      expect(row.errors).toEqual([]);
      expect(row.slug).toBe('special.combo');
    });

    it('does not error on an unmatched category — matches the pre-migration behavior of importing without one', async () => {
      const { importer } = buildImporter();
      const [row] = await importer.validateRows(wrap([{ name: 'Mystery Dish', foodCategory: 'Nonexistent' }]));
      expect(row.errors).toEqual([]);
      expect(row.foodCategoryId).toBeNull();
    });

    it('takes only the first term from a WooCommerce category path/list', async () => {
      const { importer } = buildImporter({ categories: [{ id: 7, name: 'Drinks' }] });
      const [row] = await importer.validateRows(wrap([{ name: 'Cola', foodCategory: 'Drinks > Cold Drinks' }]));
      expect(row.foodCategoryId).toBe(7);
    });

    it('extracts only the first URL from a pipe/comma/space-separated image list', async () => {
      const { importer } = buildImporter();
      const [row] = await importer.validateRows(wrap([{ name: 'Cola', imageUrl: 'a.jpg|b.jpg,c.jpg' }]));
      expect(row.imageUrl).toBe('a.jpg');
    });

    it('preserves the caller-supplied rowNumber for a chunk that does not start at row 2', async () => {
      const { importer } = buildImporter();
      const [row] = await importer.validateRows(wrap([{ name: 'Cola' }], 50));
      expect(row.rowNumber).toBe(50);
    });

    it('resolves a variant name to its id', async () => {
      const { importer } = buildImporter({ variants: [{ id: 3, name: 'Chicken' }] });
      const [row] = await importer.validateRows(wrap([{ name: 'Choila', variant: 'Chicken', basePrice: '290' }]));
      expect(row.errors).toEqual([]);
      expect(row.variantId).toBe(3);
      expect(row.basePrice).toBe(290);
    });

    it('errors on an unrecognised variant name', async () => {
      const { importer } = buildImporter();
      const [row] = await importer.validateRows(wrap([{ name: 'Choila', variant: 'Ghost' }]));
      expect(row.errors).toContain('Variant "Ghost" not found — create it in Variants first');
    });

    it('resolves a sub-variant name to its id', async () => {
      const { importer } = buildImporter({ subVariants: [{ id: 5, name: 'Full' }] });
      const [row] = await importer.validateRows(wrap([{ name: 'KhanaSet', 'sub variant': 'Full', basePrice: '400' }]));
      expect(row.errors).toEqual([]);
      expect(row.subVariantId).toBe(5);
    });

    it('errors on a non-numeric base price', async () => {
      const { importer } = buildImporter();
      const [row] = await importer.validateRows(wrap([{ name: 'Tea', basePrice: 'abc' }]));
      expect(row.errors).toContain('Base price must be a non-negative number');
    });
  });

  describe('commitRows', () => {
    it('creates the food and recomposes its SKU tree through the same transactional manager', async () => {
      const { importer, foodsRepository, skuCompositionService } = buildImporter();
      const { foodsRepository: managerFoodRepo, foodVariantsRepository: managerFVRepo } = buildRepos();
      const manager = {
        getRepository: (entity: unknown) => (entity === FoodsImporter ? managerFoodRepo : managerFVRepo),
      } as unknown as EntityManager;

      const result = await importer.commitRows(
        [
          {
            rowNumber: 2,
            name: 'Margherita Pizza',
            slug: 'margherita-pizza',
            skuSegment: null,
            shortDescription: null,
            imageUrl: null,
            foodCategory: null,
            foodCategoryName: null,
            foodCategoryId: null,
            itemType: 'ready_made',
            departmentType: null,
            basePrice: null,
            variantName: null,
            variantId: null,
            subVariantName: null,
            subVariantId: null,
            errors: [],
          },
        ],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(skuCompositionService.recomposeFoodTree).toHaveBeenCalled();
    });

    it('creates a FoodVariant when basePrice is provided', async () => {
      const { importer, skuCompositionService } = buildImporter({ variants: [{ id: 3, name: 'Chicken' }] });
      let foodVariantSaved: unknown = null;
      const managerFoodRepo = {
        create: (d: unknown) => d,
        save: jest.fn(async (f: unknown) => ({ ...(f as object), id: 1 })),
      };
      const managerFVRepo = {
        create: (d: unknown) => d,
        save: jest.fn(async (fv: unknown) => { foodVariantSaved = fv; return fv; }),
        findOne: jest.fn(async () => null),
        update: jest.fn(async () => undefined),
      };
      const manager = {
        getRepository: (entity: unknown) => {
          // FoodVariant entity class reference check
          const name = (entity as { name?: string }).name;
          return name === 'FoodVariant' ? managerFVRepo : managerFoodRepo;
        },
      } as unknown as EntityManager;

      await importer.commitRows(
        [
          {
            rowNumber: 2,
            name: 'Choila',
            slug: 'chicken-choila',
            skuSegment: 'IK07',
            shortDescription: null,
            imageUrl: null,
            foodCategory: 'nepali snacks',
            foodCategoryName: 'nepali snacks',
            foodCategoryId: null,
            itemType: 'kitchen',
            departmentType: null,
            basePrice: 290,
            variantName: 'Chicken',
            variantId: 3,
            subVariantName: null,
            subVariantId: null,
            errors: [],
          },
        ],
        manager,
      );

      expect(managerFVRepo.save).toHaveBeenCalled();
      expect((foodVariantSaved as { price?: number })?.price).toBe(290);
      expect(skuCompositionService.recomposeFoodTree).toHaveBeenCalled();
    });

    it('reuses an existing FoodVariant for the same food/variant/sub-variant instead of duplicating it', async () => {
      const { importer } = buildImporter();
      const managerFoodRepo = {
        create: (d: unknown) => d,
        save: jest.fn(async (f: unknown) => ({ ...(f as object), id: 1 })),
        update: jest.fn(async () => undefined),
        findOne: jest.fn(async () => ({ id: 1 })),
      };
      const managerFVRepo = {
        create: (d: unknown) => d,
        save: jest.fn(),
        findOne: jest.fn(async () => ({ id: 9 })),
        update: jest.fn(async () => undefined),
      };
      const manager = {
        getRepository: (entity: unknown) => {
          const name = (entity as { name?: string }).name;
          return name === 'FoodVariant' ? managerFVRepo : managerFoodRepo;
        },
        query: jest.fn(async () => undefined),
      } as unknown as EntityManager;

      const result = await importer.commitRows(
        [
          {
            rowNumber: 2,
            name: 'Choila',
            slug: 'chicken-choila',
            skuSegment: 'IK07',
            shortDescription: null,
            imageUrl: null,
            foodCategory: null,
            foodCategoryName: null,
            foodCategoryId: null,
            itemType: 'kitchen',
            departmentType: null,
            basePrice: 350,
            variantName: null,
            variantId: null,
            subVariantName: null,
            subVariantId: null,
            errors: [],
          },
        ],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(managerFVRepo.save).not.toHaveBeenCalled();
      expect(managerFVRepo.update).toHaveBeenCalledWith({ id: 9 }, { price: 350, name: 'Choila' });
    });
  });
});

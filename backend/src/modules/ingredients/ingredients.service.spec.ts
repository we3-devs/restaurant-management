import type { Repository } from 'typeorm';
import { IngredientsService } from './ingredients.service';
import type { Ingredient } from './entities/ingredient.entity';
import type { IngredientCategoriesService } from '../ingredient-categories/ingredient-categories.service';
import type { OutletsService } from '../outlets/outlets.service';
import type { UnitsService } from '../units/units.service';
import { TenantContext } from '../../common/tenant/tenant-context';

function buildService(rows: Partial<Ingredient>[] = []) {
  const repository = {
    findOne: jest.fn(async ({ where }: { where: { id: number } }) => rows.find((row) => row.id === where.id) ?? null),
    find: jest.fn(async () => rows),
    update: jest.fn(async () => undefined),
    softDelete: jest.fn(async () => undefined),
  } as unknown as Repository<Ingredient>;

  const service = new IngredientsService(
    repository,
    {} as UnitsService,
    {} as IngredientCategoriesService,
    {} as OutletsService,
    new TenantContext(),
  );

  return { service, repository };
}

describe('IngredientsService identifier release', () => {
  describe('remove', () => {
    it('frees code and slug before soft-deleting, so the values can be reused', async () => {
      const { service, repository } = buildService([
        { id: 12, code: 'FOOD-7', slug: 'pork-sadeko', barcode: null } as Ingredient,
      ]);

      await service.remove(12);

      expect(repository.update).toHaveBeenCalledWith(12, {
        code: 'FOOD-7-deleted-12',
        slug: 'pork-sadeko-deleted-12',
      });
      expect(repository.softDelete).toHaveBeenCalledWith(12);
    });

    it('leaves a null barcode alone — nulls never collide under a UNIQUE constraint', async () => {
      const { service, repository } = buildService([
        { id: 12, code: 'FOOD-7', slug: 'pork-sadeko', barcode: null } as Ingredient,
      ]);

      await service.remove(12);

      expect(repository.update).toHaveBeenCalledWith(12, expect.not.objectContaining({ barcode: expect.anything() }));
    });

    it('releases a barcode when there is one', async () => {
      const { service, repository } = buildService([
        { id: 12, code: 'FOOD-7', slug: 'pork-sadeko', barcode: '5901234123457' } as Ingredient,
      ]);

      await service.remove(12);

      expect(repository.update).toHaveBeenCalledWith(12, expect.objectContaining({ barcode: '5901234123457-deleted-12' }));
    });

    it('trims the base value rather than the suffix when the column would overflow', async () => {
      // code is varchar(80); the suffix has to survive or the released value
      // could still collide with another deleted row.
      const longCode = 'C'.repeat(80);
      const { service, repository } = buildService([
        { id: 12, code: longCode, slug: 'slug', barcode: null } as Ingredient,
      ]);

      await service.remove(12);

      const released = (repository.update as jest.Mock).mock.calls[0][1].code as string;
      expect(released).toHaveLength(80);
      expect(released.endsWith('-deleted-12')).toBe(true);
    });
  });

  describe('releaseDeletedIdentifiers', () => {
    it('renames a soft-deleted holder so the code becomes available again', async () => {
      const { service, repository } = buildService([
        { id: 5, code: 'FOOD-7', slug: 'pork-sadeko', barcode: null, deletedAt: new Date() } as Ingredient,
      ]);

      await service.releaseDeletedIdentifiers({ code: 'FOOD-7', slug: 'pork-sadeko' });

      expect(repository.update).toHaveBeenCalledWith(5, expect.objectContaining({ code: 'FOOD-7-deleted-5' }));
    });

    it('never touches a live holder — that clash is a real conflict', async () => {
      const { service, repository } = buildService([
        { id: 5, code: 'FOOD-7', slug: 'pork-sadeko', barcode: null, deletedAt: null } as Ingredient,
      ]);

      await service.releaseDeletedIdentifiers({ code: 'FOOD-7' });

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('does nothing when given no identifiers', async () => {
      const { service, repository } = buildService();

      await service.releaseDeletedIdentifiers({});

      expect(repository.find).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});

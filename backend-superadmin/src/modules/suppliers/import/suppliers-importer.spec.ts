import type { EntityManager, Repository } from 'typeorm';
import { SuppliersImporter } from './suppliers-importer';
import type { Supplier } from '../entities/supplier.entity';
import type { Outlet } from '../../outlets/entities/outlet.entity';

function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

function buildRepos(opts: {
  existingSuppliers?: { id: number; companyName: string; contactPerson: string | null; supplierNo: string }[];
  outlets?: { id: number; name: string }[];
} = {}) {
  let nextId = (opts.existingSuppliers?.length ?? 0) + 1;
  const suppliersRepository = {
    find: async () => opts.existingSuppliers ?? [],
    create: (data: Partial<Supplier>) => data as Supplier,
    save: jest.fn(async (s: Supplier) => ({ ...s, id: s.id ?? nextId++ }) as Supplier),
    update: jest.fn(async () => undefined),
  } as unknown as Repository<Supplier>;
  const outletsRepository = { find: async () => opts.outlets ?? [] } as unknown as Repository<Outlet>;
  return { suppliersRepository, outletsRepository };
}

describe('SuppliersImporter', () => {
  describe('validateRows', () => {
    it('flags a missing outlet with an exact-match error', async () => {
      const { suppliersRepository, outletsRepository } = buildRepos();
      const importer = new SuppliersImporter(suppliersRepository, outletsRepository);

      const [row] = await importer.validateRows(
        wrap([{ companyName: 'Acme', supplierNo: 'SUP-1', outlet: 'Nowhere' }]),
      );

      expect(row.errors).toContain('Outlet "Nowhere" not found — expected an existing outlet');
    });

    it('matches an existing supplier by company name + contact person for the upsert path', async () => {
      const { suppliersRepository, outletsRepository } = buildRepos({
        existingSuppliers: [{ id: 3, companyName: 'Acme', contactPerson: 'Ram', supplierNo: 'SUP-1' }],
        outlets: [{ id: 1, name: 'Downtown' }],
      });
      const importer = new SuppliersImporter(suppliersRepository, outletsRepository);

      const [row] = await importer.validateRows(
        wrap([{ companyName: 'acme', contactPerson: 'ram', supplierNo: 'SUP-9', outlet: 'Downtown' }]),
      );

      expect(row.existingId).toBe(3);
      // Matched by identity, not supplierNo — a re-import doesn't need to repeat the original number correctly.
      expect(row.errors).toEqual([]);
    });

    it('rejects a supplierNo collision for a genuinely new supplier', async () => {
      const { suppliersRepository, outletsRepository } = buildRepos({
        existingSuppliers: [{ id: 3, companyName: 'Acme', contactPerson: 'Ram', supplierNo: 'SUP-1' }],
        outlets: [{ id: 1, name: 'Downtown' }],
      });
      const importer = new SuppliersImporter(suppliersRepository, outletsRepository);

      const [row] = await importer.validateRows(
        wrap([{ companyName: 'Other Co', contactPerson: 'Someone Else', supplierNo: 'SUP-1', outlet: 'Downtown' }]),
      );

      expect(row.errors).toContain('Supplier number "SUP-1" already exists');
    });

    it('is a create for a company+contact that matches nobody', async () => {
      const { suppliersRepository, outletsRepository } = buildRepos({ outlets: [{ id: 1, name: 'Downtown' }] });
      const importer = new SuppliersImporter(suppliersRepository, outletsRepository);

      const [row] = await importer.validateRows(
        wrap([{ companyName: 'New Co', supplierNo: 'SUP-2', outlet: 'Downtown' }]),
      );

      expect(row.errors).toEqual([]);
      expect(row.existingId).toBeNull();
    });
  });

  describe('commitRows', () => {
    it('updates phone/email for an existing match', async () => {
      const { suppliersRepository, outletsRepository } = buildRepos();
      const importer = new SuppliersImporter(suppliersRepository, outletsRepository);
      const { suppliersRepository: managerRepo } = buildRepos();
      const manager = { getRepository: () => managerRepo } as unknown as EntityManager;

      await importer.commitRows(
        [
          {
            rowNumber: 2,
            supplierNo: 'SUP-1',
            companyName: 'Acme',
            contactPerson: 'Ram',
            outlet: 'Downtown',
            outletId: 1,
            phone: '123',
            email: 'a@b.com',
            existingId: 3,
            errors: [],
          },
        ],
        manager,
      );

      expect(managerRepo.update).toHaveBeenCalledWith(3, { phone: '123', email: 'a@b.com' });
      expect(managerRepo.save).not.toHaveBeenCalled();
    });
  });
});

import type { EntityManager, Repository } from 'typeorm';
import { CustomersImporter } from './customers-importer';
import type { Customer } from '../entities/customer.entity';

function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

function buildRepository(existing: { id: number; phone: string | null; email: string | null }[] = []) {
  let nextId = existing.length + 1;
  return {
    find: async () => existing,
    create: (data: Partial<Customer>) => data as Customer,
    save: jest.fn(async (c: Customer) => ({ ...c, id: c.id ?? nextId++ }) as Customer),
    update: jest.fn(async () => undefined),
  } as unknown as Repository<Customer>;
}

describe('CustomersImporter', () => {
  describe('validateRows', () => {
    it('requires at least one of phone or email', async () => {
      const importer = new CustomersImporter(buildRepository());
      const [row] = await importer.validateRows(wrap([{ name: 'Jane' }]));
      expect(row.errors).toContain('phone or email is required');
    });

    it('matches an existing customer by phone for the upsert path', async () => {
      const importer = new CustomersImporter(buildRepository([{ id: 7, phone: '9800000000', email: null }]));
      const [row] = await importer.validateRows(wrap([{ name: 'Jane', phone: '9800000000' }]));
      expect(row.existingId).toBe(7);
    });

    it('matches an existing customer by email when phone is absent', async () => {
      const importer = new CustomersImporter(buildRepository([{ id: 7, phone: null, email: 'jane@example.com' }]));
      const [row] = await importer.validateRows(wrap([{ name: 'Jane', email: 'jane@example.com' }]));
      expect(row.existingId).toBe(7);
    });

    it('is a create for a phone/email that matches nobody', async () => {
      const importer = new CustomersImporter(buildRepository());
      const [row] = await importer.validateRows(wrap([{ name: 'Jane', phone: '9800000000' }]));
      expect(row.errors).toEqual([]);
      expect(row.existingId).toBeNull();
    });
  });

  describe('commitRows', () => {
    it('updates name/address for an existing match, leaves phone/email alone', async () => {
      const importer = new CustomersImporter(buildRepository());
      const managerRepo = buildRepository();
      const manager = { getRepository: () => managerRepo } as unknown as EntityManager;

      await importer.commitRows(
        [{ rowNumber: 2, name: 'Jane Updated', phone: '9800000000', email: null, address: 'New Addr', existingId: 7, errors: [] }],
        manager,
      );

      expect(managerRepo.update).toHaveBeenCalledWith(7, { name: 'Jane Updated', address: 'New Addr' });
      expect(managerRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new customer when there is no existing match', async () => {
      const importer = new CustomersImporter(buildRepository());
      const managerRepo = buildRepository();
      const manager = { getRepository: () => managerRepo } as unknown as EntityManager;

      const result = await importer.commitRows(
        [{ rowNumber: 2, name: 'Jane', phone: '9800000000', email: null, address: null, existingId: null, errors: [] }],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(managerRepo.save).toHaveBeenCalledTimes(1);
      expect(managerRepo.update).not.toHaveBeenCalled();
    });
  });
});

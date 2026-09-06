import type { EntityManager, Repository } from 'typeorm';
import { OutletsImporter } from './outlets-importer';
import type { Outlet } from '../entities/outlet.entity';

/** Wraps bare {name} fixtures as {rowNumber, raw} pairs, numbered as if this were a fresh full-file batch (header is row 1). */
function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

function buildOutletsRepository(existingNames: string[] = []) {
  const rows: Outlet[] = existingNames.map((name, i) => ({ id: i + 1, name }) as Outlet);
  let nextId = rows.length + 1;
  return {
    find: async () => rows,
    create: (data: Partial<Outlet>) => data as Outlet,
    save: jest.fn(async (outlet: Outlet) => ({ ...outlet, id: outlet.id ?? nextId++ }) as Outlet),
  } as unknown as Repository<Outlet>;
}

describe('OutletsImporter', () => {
  describe('validateRows', () => {
    it('flags a missing name', async () => {
      const importer = new OutletsImporter(buildOutletsRepository());
      const [row] = await importer.validateRows(wrap([{ name: '' }]));
      expect(row.errors).toEqual(['name is required']);
    });

    it('flags a name that already exists in the DB (case-insensitive)', async () => {
      const importer = new OutletsImporter(buildOutletsRepository(['Downtown']));
      const [row] = await importer.validateRows(wrap([{ name: 'downtown' }]));
      expect(row.errors).toEqual(['Outlet "downtown" already exists']);
    });

    it('flags a duplicate name within the same file', async () => {
      const importer = new OutletsImporter(buildOutletsRepository());
      const rows = await importer.validateRows(wrap([{ name: 'Uptown' }, { name: 'Uptown' }]));
      expect(rows[0].errors).toEqual([]);
      expect(rows[1].errors).toEqual(['Duplicate outlet name "Uptown" in this file']);
    });

    it('passes a valid, unique name', async () => {
      const importer = new OutletsImporter(buildOutletsRepository(['Existing']));
      const [row] = await importer.validateRows(wrap([{ name: 'New Outlet' }]));
      expect(row.errors).toEqual([]);
      expect(row.name).toBe('New Outlet');
    });

    it('preserves the caller-supplied rowNumber rather than deriving it from array position — critical for revalidating an arbitrary later chunk', async () => {
      const importer = new OutletsImporter(buildOutletsRepository());
      // A chunk that starts mid-file (row 7), not from the top — array index 0 must NOT become rowNumber 2.
      const [row] = await importer.validateRows(wrap([{ name: 'Somewhere' }], 7));
      expect(row.rowNumber).toBe(7);
    });
  });

  describe('commitRows', () => {
    it('creates a row per valid input via the transactional manager, never the injected repository', async () => {
      const injectedRepository = buildOutletsRepository();
      const importer = new OutletsImporter(injectedRepository);

      const managerRepository = buildOutletsRepository();
      const manager = { getRepository: () => managerRepository } as unknown as EntityManager;

      const result = await importer.commitRows([{ rowNumber: 2, name: 'New Outlet', errors: [] }], manager);

      expect(result.committedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.succeeded).toEqual([{ rowNumber: 2, entityId: 1 }]);
      expect(managerRepository.save).toHaveBeenCalledTimes(1);
      expect(injectedRepository.save).not.toHaveBeenCalled();
    });
  });
});

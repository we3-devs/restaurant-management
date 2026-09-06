import type { EntityManager, Repository } from 'typeorm';
import { EmployeesImporter } from './employees-importer';
import type { Employee } from '../entities/employee.entity';
import type { Position } from '../entities/position.entity';
import type { Outlet } from '../../outlets/entities/outlet.entity';

function wrap(raws: Record<string, string>[], startAt = 2) {
  return raws.map((raw, index) => ({ rowNumber: startAt + index, raw }));
}

function buildRepos(opts: {
  existingEmployees?: { employeeCode: string }[];
  positions?: { id: number; name: string }[];
  outlets?: { id: number; name: string }[];
} = {}) {
  let nextId = 1;
  const employeesRepository = {
    find: async () => opts.existingEmployees ?? [],
    create: (data: Partial<Employee>) => data as Employee,
    save: jest.fn(async (e: Employee) => ({ ...e, id: e.id ?? nextId++ }) as Employee),
  } as unknown as Repository<Employee>;
  const positionsRepository = { find: async () => opts.positions ?? [] } as unknown as Repository<Position>;
  const outletsRepository = { find: async () => opts.outlets ?? [] } as unknown as Repository<Outlet>;
  return { employeesRepository, positionsRepository, outletsRepository };
}

describe('EmployeesImporter', () => {
  describe('validateRows', () => {
    it('flags a missing outlet with an exact-match error', async () => {
      const { employeesRepository, positionsRepository, outletsRepository } = buildRepos();
      const importer = new EmployeesImporter(employeesRepository, positionsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ name: 'Jane', employeeCode: 'EMP-1', outlet: 'Nowhere' }]));

      expect(row.errors).toContain('Outlet "Nowhere" not found — expected an existing outlet');
    });

    it('flags a missing position with an exact-match error when one is provided', async () => {
      const { employeesRepository, positionsRepository, outletsRepository } = buildRepos({
        outlets: [{ id: 1, name: 'Downtown' }],
      });
      const importer = new EmployeesImporter(employeesRepository, positionsRepository, outletsRepository);

      const [row] = await importer.validateRows(
        wrap([{ name: 'Jane', employeeCode: 'EMP-1', outlet: 'Downtown', position: 'Ghost Role' }]),
      );

      expect(row.errors).toContain('Position "Ghost Role" not found — expected an existing position');
    });

    it('does not require a position at all', async () => {
      const { employeesRepository, positionsRepository, outletsRepository } = buildRepos({
        outlets: [{ id: 1, name: 'Downtown' }],
      });
      const importer = new EmployeesImporter(employeesRepository, positionsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ name: 'Jane', employeeCode: 'EMP-1', outlet: 'Downtown' }]));

      expect(row.errors).toEqual([]);
      expect(row.positionId).toBeNull();
    });

    it('is create-only — an employeeCode that already exists is a validation error, never treated as an update', async () => {
      const { employeesRepository, positionsRepository, outletsRepository } = buildRepos({
        existingEmployees: [{ employeeCode: 'EMP-1' }],
        outlets: [{ id: 1, name: 'Downtown' }],
      });
      const importer = new EmployeesImporter(employeesRepository, positionsRepository, outletsRepository);

      const [row] = await importer.validateRows(wrap([{ name: 'Jane', employeeCode: 'emp-1', outlet: 'Downtown' }]));

      expect(row.errors).toEqual(['Employee code "emp-1" already exists']);
    });
  });

  describe('commitRows', () => {
    it('creates the employee with no linked user account (no login credentials imported)', async () => {
      const { employeesRepository, positionsRepository, outletsRepository } = buildRepos();
      const importer = new EmployeesImporter(employeesRepository, positionsRepository, outletsRepository);
      const { employeesRepository: managerRepo } = buildRepos();
      const manager = { getRepository: () => managerRepo } as unknown as EntityManager;

      const result = await importer.commitRows(
        [
          {
            rowNumber: 2,
            employeeCode: 'EMP-1',
            name: 'Jane',
            outlet: 'Downtown',
            outletId: 1,
            position: '',
            positionId: null,
            email: null,
            phone: null,
            errors: [],
          },
        ],
        manager,
      );

      expect(result.committedCount).toBe(1);
      expect(managerRepo.create).toBeDefined();
      expect(managerRepo.save).toHaveBeenCalledTimes(1);
      const savedArg = (managerRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedArg).not.toHaveProperty('userId');
    });
  });
});

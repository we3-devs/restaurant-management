import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { DataImportService } from './data-import.service';
import { ImporterRegistry } from './importer-registry';
import type { StorageService } from '../uploads/storage.service';
import type { ImportJob } from './entities/import-job.entity';
import type { ImportJobRow, ImportJobRowStatus } from './entities/import-job-row.entity';
import type { ImportDomainConfig } from './interfaces/import-domain-config.interface';
import type { ImportValidatedRow } from './interfaces/import-row.interface';

interface FakeRow extends ImportValidatedRow {
  name: string;
}

/** A throwaway no-op domain importer, used only to exercise the generic engine end to end before any real domain exists. */
function buildFakeImporter(overrides?: Partial<ImportDomainConfig<Record<string, string>, FakeRow>>): ImportDomainConfig<Record<string, string>, FakeRow> {
  let nextEntityId = 1;
  return {
    domain: 'fake',
    label: 'Fake',
    mode: 'create',
    headerAliases: { name: 'name' },
    validateRows: async (rows) =>
      rows.map(({ rowNumber, raw }) => ({
        rowNumber,
        name: raw.name ?? '',
        errors: raw.name ? [] : ['name is required'],
      })),
    commitRows: async (rows) => ({
      committedCount: rows.length,
      failedCount: 0,
      succeeded: rows.map((row) => ({ rowNumber: row.rowNumber, entityId: nextEntityId++ })),
      failures: [],
    }),
    buildTemplate: async () => Buffer.from(''),
    ...overrides,
  };
}

function buildJobsRepository(initial: Partial<ImportJob>[] = []) {
  const store = new Map<number, ImportJob>();
  let nextId = 1;
  for (const job of initial) {
    const id = nextId++;
    store.set(id, { id, ...job } as ImportJob);
  }

  return {
    create: (data: Partial<ImportJob>) => ({ ...data }) as ImportJob,
    save: async (job: ImportJob) => {
      const id = job.id ?? nextId++;
      const saved = { ...job, id } as ImportJob;
      store.set(id, saved);
      return saved;
    },
    findOne: async ({ where }: { where: { id: number } }) => store.get(where.id) ?? null,
    find: async () => [...store.values()],
  } as unknown as Repository<ImportJob>;
}

interface FakeTrackedRow {
  id: number;
  jobId: number;
  rowNumber: number;
  clientRowId: string;
  status: ImportJobRowStatus;
  errorMessage: string | null;
  entityId: number | null;
  updatedAt: Date;
}

/**
 * Backs both the injected `Repository<ImportJobRow>` (for the pairing-insert
 * and count-based settling) and the transactional `manager.query`/`.update`
 * calls the atomic-claim logic issues — same underlying store, since a real
 * transaction and its repository see the same rows.
 */
function buildJobRowsStore() {
  const rows: FakeTrackedRow[] = [];
  let nextId = 1;

  const repository = {
    createQueryBuilder: () => ({
      insert: () => ({
        into: () => ({
          values: (values: Partial<FakeTrackedRow>[]) => ({
            orIgnore: () => ({
              execute: async () => {
                for (const v of values) {
                  const exists = rows.some((r) => r.jobId === v.jobId && r.clientRowId === v.clientRowId);
                  if (!exists) {
                    rows.push({
                      id: nextId++,
                      jobId: v.jobId!,
                      rowNumber: v.rowNumber!,
                      clientRowId: v.clientRowId!,
                      status: 'pending',
                      errorMessage: null,
                      entityId: null,
                      updatedAt: new Date(),
                    });
                  }
                }
              },
            }),
          }),
        }),
      }),
    }),
    find: async ({ where }: { where: { jobId: number; clientRowId: { value: string[] } } }) => {
      const ids = where.clientRowId.value;
      return rows.filter((r) => r.jobId === where.jobId && ids.includes(r.clientRowId));
    },
    count: async ({ where }: { where: { jobId: number; status: ImportJobRowStatus } }) =>
      rows.filter((r) => r.jobId === where.jobId && r.status === where.status).length,
  } as unknown as Repository<ImportJobRow>;

  const manager = {
    query: async (_sql: string, params: [number, string[]]) => {
      const [jobId, clientRowIds] = params;
      const staleThresholdMs = Date.now() - 5 * 60 * 1000;
      const claimed = rows.filter(
        (r) =>
          r.jobId === jobId &&
          clientRowIds.includes(r.clientRowId) &&
          (r.status === 'pending' || (r.status === 'processing' && r.updatedAt.getTime() < staleThresholdMs)),
      );
      for (const r of claimed) {
        r.status = 'processing';
        r.updatedAt = new Date();
      }
      const mapped = claimed.map((r) => ({ id: r.id, rowNumber: r.rowNumber, clientRowId: r.clientRowId }));
      // Real TypeORM/pg returns [rows, affectedCount] for an UPDATE ... RETURNING,
      // not just the rows array — mirror that here so this fake would have caught
      // the bug where the service destructured the wrong shape.
      return [mapped, mapped.length];
    },
    update: async (_entity: unknown, id: number, patch: Partial<FakeTrackedRow>) => {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
    },
  } as unknown as EntityManager;

  return { repository, manager, rows };
}

function buildDataSource(manager: EntityManager) {
  return { transaction: async (fn: (m: EntityManager) => Promise<unknown>) => fn(manager) };
}

function buildStorageService() {
  return { saveFile: jest.fn().mockResolvedValue('import/fake-key.csv') } as unknown as StorageService;
}

function buildService(jobs: Partial<ImportJob>[] = [], importer = buildFakeImporter()) {
  const jobsRepository = buildJobsRepository(jobs);
  const { repository: jobRowsRepository, manager } = buildJobRowsStore();
  const registry = new ImporterRegistry([importer]);
  const service = new DataImportService(
    jobsRepository,
    jobRowsRepository,
    buildDataSource(manager) as never,
    registry,
    buildStorageService(),
  );
  return { service, jobsRepository };
}

describe('DataImportService', () => {
  it('creates a job on preview and reports validation errors without committing anything', async () => {
    const { service, jobsRepository } = buildService();

    const file = {
      buffer: Buffer.from('name\nAlice\n\nBob'),
      mimetype: 'text/csv',
      originalname: 'people.csv',
    } as Express.Multer.File;

    const { jobId, rows } = await service.preview('fake', file, 42);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);

    const jobs = await jobsRepository.find();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: jobId, domain: 'fake', status: 'previewed', createdByUserId: 42, totalRows: 2 });
  });

  it('rejects a commit for a job owned by a different user', async () => {
    const { service } = buildService([
      { domain: 'fake', status: 'previewed', createdByUserId: 1, totalRows: 1, successRows: 0, errorRows: 0 },
    ]);

    await expect(
      service.commit('fake', { jobId: 1, rows: [{ clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } }] }, 999),
    ).rejects.toThrow(ForbiddenException);
  });

  it('404s when the job domain does not match the :domain path param', async () => {
    const { service } = buildService([
      { domain: 'other-domain', status: 'previewed', createdByUserId: 1, totalRows: 1, successRows: 0, errorRows: 0 },
    ]);

    await expect(
      service.commit('fake', { jobId: 1, rows: [{ clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } }] }, 1),
    ).rejects.toThrow(NotFoundException);
  });

  it('never trusts a prior revalidate — commit re-validates and refuses to commit rows that are actually invalid', async () => {
    const { service } = buildService([
      { domain: 'fake', status: 'previewed', createdByUserId: 1, totalRows: 2, successRows: 0, errorRows: 0 },
    ]);

    const { result, stillInvalid } = await service.commit(
      'fake',
      {
        jobId: 1,
        rows: [
          { clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } },
          // Client claims this was revalidated, but it's actually missing `name` — the server must catch it itself.
          { clientRowId: 'row-2', rowNumber: 3, values: { name: '' } },
        ],
      },
      1,
    );

    expect(result.committedCount).toBe(1);
    expect(stillInvalid).toHaveLength(1);
  });

  it('settles the job into `committing` while rows remain unaccounted for, and `completed` once every row lands', async () => {
    const { service } = buildService([
      { domain: 'fake', status: 'previewed', createdByUserId: 1, totalRows: 2, successRows: 0, errorRows: 0 },
    ]);

    const first = await service.commit(
      'fake',
      { jobId: 1, rows: [{ clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } }] },
      1,
    );
    expect(first.job.status).toBe('committing');

    const second = await service.commit(
      'fake',
      { jobId: 1, rows: [{ clientRowId: 'row-2', rowNumber: 3, values: { name: 'Bob' } }] },
      1,
    );
    expect(second.job.status).toBe('completed');
  });

  it('settles a job to `failed_partial` when every row is accounted for but some failed', async () => {
    const { service } = buildService([
      { domain: 'fake', status: 'previewed', createdByUserId: 1, totalRows: 2, successRows: 0, errorRows: 0 },
    ]);

    const { job } = await service.commit(
      'fake',
      {
        jobId: 1,
        rows: [
          { clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } },
          { clientRowId: 'row-2', rowNumber: 3, values: { name: '' } },
        ],
      },
      1,
    );

    expect(job.status).toBe('failed_partial');
  });

  it('is idempotent: committing the exact same chunk twice does not double-count or re-commit already-committed rows', async () => {
    const { service } = buildService([
      { domain: 'fake', status: 'previewed', createdByUserId: 1, totalRows: 1, successRows: 0, errorRows: 0 },
    ]);
    const chunk = { jobId: 1, rows: [{ clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } }] };

    const first = await service.commit('fake', chunk, 1);
    expect(first.result.committedCount).toBe(1);
    expect(first.job.successRows).toBe(1);

    // Retry of the exact same request (e.g. the client never saw the first response).
    const second = await service.commit('fake', chunk, 1);
    expect(second.result.committedCount).toBe(0); // already committed — nothing left to claim
    expect(second.job.successRows).toBe(1); // still exactly one committed row, not two
    expect(second.job.status).toBe('completed');
  });

  it('is safe under two concurrent commit requests for the same chunk (no double claim)', async () => {
    const { service } = buildService([
      { domain: 'fake', status: 'previewed', createdByUserId: 1, totalRows: 1, successRows: 0, errorRows: 0 },
    ]);
    const chunk = { jobId: 1, rows: [{ clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } }] };

    const [a, b] = await Promise.all([service.commit('fake', chunk, 1), service.commit('fake', chunk, 1)]);
    const totalCommitted = a.result.committedCount + b.result.committedCount;

    expect(totalCommitted).toBe(1); // exactly one of the two requests claimed the row
  });

  it('rejects resubmitting a clientRowId under a different rowNumber than its first attempt', async () => {
    const { service } = buildService([
      { domain: 'fake', status: 'previewed', createdByUserId: 1, totalRows: 1, successRows: 0, errorRows: 0 },
    ]);

    await service.commit('fake', { jobId: 1, rows: [{ clientRowId: 'row-1', rowNumber: 2, values: { name: 'Alice' } }] }, 1);

    await expect(
      service.commit('fake', { jobId: 1, rows: [{ clientRowId: 'row-1', rowNumber: 99, values: { name: 'Alice' } }] }, 1),
    ).rejects.toThrow(BadRequestException);
  });
});

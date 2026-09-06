import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ALLOWED_IMPORT_TYPES } from '../uploads/uploads.constants';
import { StorageService } from '../uploads/storage.service';
import { ImportJob } from './entities/import-job.entity';
import { ImportJobRow } from './entities/import-job-row.entity';
import { ImporterRegistry } from './importer-registry';
import { parseImportFile } from './import-parser.util';
import type { ImportCommitResult } from './interfaces/import-result.interface';
import type { ImportValidatedRow } from './interfaces/import-row.interface';
import type { CommitImportDto } from './dto/commit-import.dto';
import type { RevalidateImportDto } from './dto/revalidate-import.dto';

const MAX_ERROR_SUMMARY_ROWS = 20;
/** A row stuck `processing` past this window is assumed to belong to a request that crashed before finishing, and becomes eligible for another request to reclaim. */
const CLAIM_STALE_MINUTES = 5;
const EMPTY_COMMIT_RESULT: ImportCommitResult = { committedCount: 0, failedCount: 0, succeeded: [], failures: [] };

function summariseErrors(rows: ImportValidatedRow[]): Record<string, unknown> | null {
  const failing = rows.filter((row) => row.errors.length > 0).slice(0, MAX_ERROR_SUMMARY_ROWS);
  if (failing.length === 0) return null;
  return { sample: failing.map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })) };
}

@Injectable()
export class DataImportService {
  constructor(
    @InjectRepository(ImportJob)
    private readonly jobsRepository: Repository<ImportJob>,
    @InjectRepository(ImportJobRow)
    private readonly jobRowsRepository: Repository<ImportJobRow>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly registry: ImporterRegistry,
    private readonly storageService: StorageService,
  ) {}

  listDomains() {
    return this.registry.list();
  }

  listJobs(domain?: string, status?: string) {
    return this.jobsRepository.find({
      where: { ...(domain ? { domain } : {}), ...(status ? { status: status as ImportJob['status'] } : {}) },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getJobDetail(domain: string, jobId: number, userId: number) {
    return this.getOwnedJob(domain, jobId, userId);
  }

  /**
   * Resolves a job and verifies it both belongs to the requesting user and
   * matches the :domain path param — every route is already superadmin-
   * gated, but that doesn't mean one superadmin should be able to poke at or
   * resume another superadmin's in-flight job by guessing/incrementing a job
   * id.
   */
  private async getOwnedJob(domain: string, jobId: number, userId: number): Promise<ImportJob> {
    const job = await this.jobsRepository.findOne({ where: { id: jobId } });
    if (!job || job.domain !== domain) {
      throw new NotFoundException(`Import job ${jobId} not found for domain "${domain}"`);
    }
    if (job.createdByUserId !== userId) {
      throw new ForbiddenException('This import job belongs to a different user');
    }
    return job;
  }

  async preview(domain: string, file: Express.Multer.File | undefined, userId: number) {
    if (!file) {
      throw new BadRequestException('A CSV or Excel file is required');
    }
    const config = this.registry.get(domain);

    const rawRows = await parseImportFile(file.buffer, file.mimetype, file.originalname, config.headerAliases, {
      rowFilter: config.rowFilter,
    });
    // Header is row 1, so the first data row is 2 — this is the one place
    // rowNumber is derived from array position, because this is genuinely
    // the full, freshly parsed, from-the-top batch.
    const rows = await config.validateRows(rawRows.map((raw, index) => ({ rowNumber: index + 2, raw })));

    const extension = ALLOWED_IMPORT_TYPES[file.mimetype] ?? '.csv';
    const storageKey = await this.storageService.saveFile(file.buffer, file.mimetype, extension, 'import');

    const job = await this.jobsRepository.save(
      this.jobsRepository.create({
        domain,
        status: 'previewed',
        originalFilename: file.originalname,
        storageKey,
        totalRows: rows.length,
        successRows: 0,
        errorRows: rows.filter((row) => row.errors.length > 0).length,
        errorSummary: summariseErrors(rows),
        createdByUserId: userId,
      }),
    );

    return { jobId: job.id, rows };
  }

  async revalidate(domain: string, dto: RevalidateImportDto, userId: number) {
    const job = await this.getOwnedJob(domain, dto.jobId, userId);
    const config = this.registry.get(domain);

    const rows = await config.validateRows(dto.rows.map((row) => ({ rowNumber: row.rowNumber, raw: row.values })));

    job.errorRows = rows.filter((row) => row.errors.length > 0).length;
    job.errorSummary = summariseErrors(rows);
    await this.jobsRepository.save(job);

    return { jobId: job.id, rows };
  }

  /**
   * Commits one chunk. Idempotent and safe under retries/concurrent requests
   * for the same chunk:
   *  1. Ensures every submitted row has an `import_job_rows` tracking entry
   *     (first attempt wins the (clientRowId -> rowNumber) pairing; a later
   *     request resubmitting the same clientRowId under a different
   *     rowNumber is rejected outright).
   *  2. Atomically claims only rows still `pending`, or `processing` past
   *     the staleness window — a single conditional UPDATE, never a
   *     read-then-write, so two concurrent/retried requests can't both claim
   *     the same row.
   *  3. Re-validates the claimed rows itself — never trusts that a prior
   *     revalidate call means these values are still valid.
   *  4. Commits the still-valid claimed rows inside one transaction scoped
   *     to this chunk (not the whole job), through the transaction's own
   *     EntityManager — importers must write through it, nothing else.
   *  5. Recomputes the job's success/error counts from `import_job_rows`
   *     directly (not by incrementing), so a reclaimed/retried row can never
   *     be double-counted.
   */
  async commit(domain: string, dto: CommitImportDto, userId: number) {
    const job = await this.getOwnedJob(domain, dto.jobId, userId);
    const config = this.registry.get(domain);

    if (dto.rows.length === 0) {
      return { job, result: EMPTY_COMMIT_RESULT, stillInvalid: [] as ImportValidatedRow[] };
    }

    const incoming = new Map(dto.rows.map((row) => [row.clientRowId, row]));
    const clientRowIds = [...incoming.keys()];

    // First attempt for each row wins the (clientRowId, rowNumber) pairing —
    // ON CONFLICT DO NOTHING makes this safe under concurrent first attempts too.
    await this.jobRowsRepository
      .createQueryBuilder()
      .insert()
      .into(ImportJobRow)
      .values(
        dto.rows.map((row) => ({
          jobId: job.id,
          clientRowId: row.clientRowId,
          rowNumber: row.rowNumber,
          status: 'pending' as const,
        })),
      )
      .orIgnore()
      .execute();

    const trackedRows = await this.jobRowsRepository.find({
      where: { jobId: job.id, clientRowId: In(clientRowIds) },
    });
    for (const tracked of trackedRows) {
      const submitted = incoming.get(tracked.clientRowId);
      if (submitted && submitted.rowNumber !== tracked.rowNumber) {
        throw new BadRequestException(
          `Row "${tracked.clientRowId}" was first submitted as row ${tracked.rowNumber} — cannot resubmit it as row ${submitted.rowNumber}`,
        );
      }
    }

    const { result, stillInvalid } = await this.dataSource.transaction(async (manager) => {
      // manager.query() for an UPDATE ... RETURNING returns a [rows, affectedCount]
      // tuple in the postgres driver, not just the rows array — unlike a plain SELECT.
      const [claimed]: [{ id: string; rowNumber: number; clientRowId: string }[], number] = await manager.query(
        `UPDATE import_job_rows
         SET status = 'processing', updated_at = now()
         WHERE job_id = $1
           AND client_row_id = ANY($2)
           AND (status = 'pending' OR (status = 'processing' AND updated_at < now() - interval '${CLAIM_STALE_MINUTES} minutes'))
         RETURNING id, row_number AS "rowNumber", client_row_id AS "clientRowId"`,
        [job.id, clientRowIds],
      );

      if (claimed.length === 0) {
        return { result: EMPTY_COMMIT_RESULT, stillInvalid: [] as ImportValidatedRow[] };
      }

      const revalidated = await config.validateRows(
        claimed.map((row) => ({ rowNumber: row.rowNumber, raw: incoming.get(row.clientRowId)!.values })),
      );
      const validRows = revalidated.filter((row) => row.errors.length === 0);
      const invalidRows = revalidated.filter((row) => row.errors.length > 0);

      const commitResult = validRows.length > 0 ? await config.commitRows(validRows, manager) : EMPTY_COMMIT_RESULT;

      const succeededByRowNumber = new Map(commitResult.succeeded.map((s) => [s.rowNumber, s.entityId]));
      const failedByRowNumber = new Map(commitResult.failures.map((f) => [f.rowNumber, f.error]));

      for (const claimedRow of claimed) {
        const revalidationFailure = invalidRows.find((row) => row.rowNumber === claimedRow.rowNumber);
        if (revalidationFailure) {
          await manager.update(ImportJobRow, claimedRow.id, {
            status: 'failed',
            errorMessage: revalidationFailure.errors.join('; '),
          });
          continue;
        }
        const entityId = succeededByRowNumber.get(claimedRow.rowNumber);
        if (entityId !== undefined) {
          await manager.update(ImportJobRow, claimedRow.id, { status: 'committed', entityId });
          continue;
        }
        await manager.update(ImportJobRow, claimedRow.id, {
          status: 'failed',
          errorMessage: failedByRowNumber.get(claimedRow.rowNumber) ?? 'Commit failed',
        });
      }

      return { result: commitResult, stillInvalid: invalidRows };
    });

    const [successRows, errorRows] = await Promise.all([
      this.jobRowsRepository.count({ where: { jobId: job.id, status: 'committed' } }),
      this.jobRowsRepository.count({ where: { jobId: job.id, status: 'failed' } }),
    ]);
    job.successRows = successRows;
    job.errorRows = errorRows;

    // Only settle into a terminal status once every row is accounted for —
    // a job that still has rows neither committed nor failed simply stays
    // `committing` (resumable). A request that never arrives is never, on
    // its own, grounds for marking a job failed/failed_partial.
    const allRowsAccountedFor = job.successRows + job.errorRows >= job.totalRows;
    job.status = allRowsAccountedFor
      ? job.successRows === 0
        ? 'failed'
        : job.errorRows > 0
          ? 'failed_partial'
          : 'completed'
      : 'committing';
    await this.jobsRepository.save(job);

    return { job, result, stillInvalid };
  }
}

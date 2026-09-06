import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type ImportJobStatus = 'previewed' | 'committing' | 'completed' | 'failed' | 'failed_partial';

/**
 * Metadata for one superadmin data-import run — lean by design, NOT a
 * dataset store. The corrected rows themselves are never persisted here or
 * anywhere server-side before commit; preview/revalidate results round-trip
 * through the frontend only, the same way the pre-existing Foods importer
 * works. `errorSummary` is a small top-N summary, not the full row/error
 * list (that level of detail is `import_job_rows`, added in Phase 3).
 *
 * Status semantics:
 *   previewed      - file parsed/validated, nothing committed yet.
 *   committing      - at least one chunk committed, more may still be coming
 *                     (or the job is simply mid-flight) — resumable, not broken.
 *   completed       - every valid row committed, the job is done.
 *   failed          - zero rows committed (e.g. the very first chunk failed).
 *   failed_partial  - the job is done (no more chunks coming) with a mix of
 *                     committed and failed rows.
 * A vanished/never-retried request is never, on its own, grounds for marking
 * a job failed or failed_partial — see data-import.service.ts.
 */
@Entity({ name: 'import_jobs' })
@Index(['domain', 'createdAt'])
export class ImportJob {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  domain: string;

  @Column({ type: 'varchar', length: 20, default: 'previewed' })
  status: ImportJobStatus;

  @Column({ name: 'original_filename', type: 'varchar', length: 500 })
  originalFilename: string;

  /** The raw uploaded file's key/URL in StorageService (purpose 'import'), null if the upload step failed before storing it. */
  @Column({ name: 'storage_key', type: 'varchar', length: 1000, nullable: true })
  storageKey: string | null;

  @Column({ name: 'total_rows', type: 'integer', default: 0 })
  totalRows: number;

  @Column({ name: 'success_rows', type: 'integer', default: 0 })
  successRows: number;

  @Column({ name: 'error_rows', type: 'integer', default: 0 })
  errorRows: number;

  @Column({ name: 'error_summary', type: 'jsonb', nullable: true })
  errorSummary: Record<string, unknown> | null;

  @Column({
    name: 'created_by_user_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  createdByUserId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

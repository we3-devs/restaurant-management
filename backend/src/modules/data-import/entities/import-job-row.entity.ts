import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';

export type ImportJobRowStatus = 'pending' | 'processing' | 'committed' | 'failed';

/**
 * Per-row commit tracking for one import job — what makes chunked commits
 * safe to retry after a browser crash or network failure. Row *data* (the
 * corrected values) is deliberately NOT stored here or anywhere server-side
 * before commit; only identity + outcome. Preview/revalidate results stay
 * ephemeral, round-tripped through the frontend only, the same way the
 * pre-existing Foods importer works — nothing durable exists until a row is
 * actually committed. Trade-off: a browser crash mid-edit loses in-progress
 * corrections and the user re-uploads/re-previews; that's an accepted
 * limitation, not something to "fix" by starting to persist row data here.
 *
 * `updatedAt` doubles as the claim lease timestamp — a row stuck in
 * `processing` past a short staleness window (the request that claimed it
 * crashed before finishing) becomes eligible for another request to
 * re-claim. See data-import.service.ts#commit for the atomic claim query.
 *
 * The unique (jobId, clientRowId) index is what makes a retried commit
 * request a no-op instead of a duplicate insert/claim.
 */
@Entity({ name: 'import_job_rows' })
@Unique(['jobId', 'clientRowId'])
@Index(['jobId', 'status'])
export class ImportJobRow {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({
    name: 'job_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  jobId: number;

  /** Stable 1-based position from the originally parsed file (header is row 1) — what the row's clientRowId is verified against on first commit. */
  @Column({ name: 'row_number', type: 'integer' })
  rowNumber: number;

  @Column({ name: 'client_row_id', type: 'varchar', length: 100 })
  clientRowId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ImportJobRowStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /** The created/updated record's id, once committed. */
  @Column({ name: 'entity_id', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  entityId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

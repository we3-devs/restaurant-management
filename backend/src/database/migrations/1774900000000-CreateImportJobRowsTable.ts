import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-row commit tracking for the data-import portal (see
 * backend/src/modules/data-import/entities/import-job-row.entity.ts) — makes
 * chunked commits idempotent/retry-safe. The unique (job_id, client_row_id)
 * index is what turns a retried commit request into a no-op instead of a
 * duplicate write.
 */
export class CreateImportJobRowsTable1774900000000 implements MigrationInterface {
  name = 'CreateImportJobRowsTable1774900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE import_job_rows (
        id BIGSERIAL PRIMARY KEY,
        job_id BIGINT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
        row_number INTEGER NOT NULL,
        client_row_id VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'committed', 'failed')),
        error_message TEXT,
        entity_id BIGINT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (job_id, client_row_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_import_job_rows_job_id_status ON import_job_rows (job_id, status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS import_job_rows`);
  }
}

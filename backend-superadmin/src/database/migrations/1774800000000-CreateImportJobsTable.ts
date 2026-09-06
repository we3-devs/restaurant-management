import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Job metadata for the superadmin data-import portal (see
 * backend/src/modules/data-import/). Lean by design — row/error detail
 * beyond errorSummary's small sample lives in import_job_rows, added in a
 * later migration once idempotent chunked commits land.
 */
export class CreateImportJobsTable1774800000000 implements MigrationInterface {
  name = 'CreateImportJobsTable1774800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE import_jobs (
        id BIGSERIAL PRIMARY KEY,
        domain VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'previewed'
          CHECK (status IN ('previewed', 'committing', 'completed', 'failed', 'failed_partial')),
        original_filename VARCHAR(500) NOT NULL,
        storage_key VARCHAR(1000),
        total_rows INTEGER NOT NULL DEFAULT 0,
        success_rows INTEGER NOT NULL DEFAULT 0,
        error_rows INTEGER NOT NULL DEFAULT 0,
        error_summary JSONB,
        created_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_import_jobs_domain_created_at ON import_jobs (domain, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS import_jobs`);
  }
}

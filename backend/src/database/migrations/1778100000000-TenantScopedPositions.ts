import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantScopedPositions1778100000000 implements MigrationInterface {
  name = 'TenantScopedPositions1778100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS tenant_id BIGINT NULL`);
    await queryRunner.query(`ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_slug_key`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS positions_tenant_slug_unique ON positions (tenant_id, slug)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS positions_template_slug_unique ON positions (slug) WHERE tenant_id IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS positions_tenant_id_idx ON positions (tenant_id)`);
    await queryRunner.query(`DO $$ BEGIN ALTER TABLE positions ADD CONSTRAINT positions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_tenant_id_fkey`);
    await queryRunner.query(`DROP INDEX IF EXISTS positions_tenant_id_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS positions_tenant_slug_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS positions_template_slug_unique`);
    await queryRunner.query(`ALTER TABLE positions ADD CONSTRAINT positions_slug_key UNIQUE (slug)`);
    await queryRunner.query(`ALTER TABLE positions DROP COLUMN IF EXISTS tenant_id`);
  }
}

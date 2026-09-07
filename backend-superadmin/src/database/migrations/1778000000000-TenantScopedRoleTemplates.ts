import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantScopedRoleTemplates1778000000000 implements MigrationInterface {
  name = 'TenantScopedRoleTemplates1778000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS tenant_id BIGINT NULL`);
    await queryRunner.query(`ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_slug_key`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_slug_unique ON roles (tenant_id, slug)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS roles_template_slug_unique ON roles (slug) WHERE tenant_id IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS roles_tenant_id_idx ON roles (tenant_id)`);
    await queryRunner.query(`DO $$ BEGIN ALTER TABLE roles ADD CONSTRAINT roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_tenant_id_fkey`);
    await queryRunner.query(`DROP INDEX IF EXISTS roles_tenant_id_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS roles_tenant_slug_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS roles_template_slug_unique`);
    await queryRunner.query(`ALTER TABLE roles ADD CONSTRAINT roles_slug_key UNIQUE (slug)`);
    await queryRunner.query(`ALTER TABLE roles DROP COLUMN IF EXISTS tenant_id`);
  }
}

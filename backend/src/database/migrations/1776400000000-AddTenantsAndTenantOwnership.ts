import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantsAndTenantOwnership1776400000000 implements MigrationInterface {
  name = 'AddTenantsAndTenantOwnership1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS tenants (id BIGSERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(255) UNIQUE NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id BIGINT`);
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS tenant_id BIGINT`);
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`);
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS users_email_unique`);
    await queryRunner.query(`INSERT INTO tenants (name, slug) SELECT 'Demo Hotel', 'demo' WHERE NOT EXISTS (SELECT 1 FROM tenants)`);
    await queryRunner.query(`UPDATE outlets SET tenant_id = (SELECT id FROM tenants ORDER BY id LIMIT 1) WHERE tenant_id IS NULL`);
    await queryRunner.query(`UPDATE users SET tenant_id = (SELECT id FROM tenants ORDER BY id LIMIT 1) WHERE tenant_id IS NULL AND is_superadmin = FALSE`);
    await queryRunner.query(`DO $$ BEGIN ALTER TABLE users ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`DO $$ BEGIN ALTER TABLE outlets ADD CONSTRAINT outlets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users (tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS outlets_tenant_id_idx ON outlets (tenant_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_unique ON users (tenant_id, lower(email)) WHERE tenant_id IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_superadmin_email_unique ON users (lower(email)) WHERE is_superadmin = TRUE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE outlets DROP CONSTRAINT IF EXISTS outlets_tenant_id_fkey`);
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_fkey`);
    await queryRunner.query(`DROP INDEX IF EXISTS outlets_tenant_id_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS users_tenant_id_idx`);
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS tenant_id`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS tenant_id`);
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email)`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
  }
}

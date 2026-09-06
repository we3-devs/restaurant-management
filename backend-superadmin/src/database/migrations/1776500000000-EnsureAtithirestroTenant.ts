import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Provision the second production tenant explicitly. The original tenant
 * migration only created demo when the table was empty, so adding a tenant
 * after demo had already been installed was a no-op.
 */
export class EnsureAtithirestroTenant1776500000000 implements MigrationInterface {
  name = 'EnsureAtithirestroTenant1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO tenants (name, slug, is_active)
      VALUES ('Atithi Restro', 'atithirestro', true)
      ON CONFLICT (slug) DO UPDATE SET is_active = true, updated_at = NOW()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Do not delete tenant-owned data during rollback. Deactivate instead so
    // a rollback cannot accidentally make another tenant's records visible.
    await queryRunner.query(`
      UPDATE tenants SET is_active = false, updated_at = NOW()
      WHERE slug = 'atithirestro'
    `);
  }
}

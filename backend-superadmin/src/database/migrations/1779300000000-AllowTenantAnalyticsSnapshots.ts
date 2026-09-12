import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowTenantAnalyticsSnapshots1779300000000 implements MigrationInterface {
  name = 'AllowTenantAnalyticsSnapshots1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE analytics_daily_snapshots ADD COLUMN IF NOT EXISTS tenant_id BIGINT NULL`);
    await queryRunner.query(`ALTER TABLE analytics_daily_snapshots ALTER COLUMN outlet_id DROP NOT NULL`);
    await queryRunner.query(`DO $$ BEGIN ALTER TABLE analytics_daily_snapshots ADD CONSTRAINT analytics_daily_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_snapshots_tenant_lookup ON analytics_daily_snapshots(tenant_id, business_date)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_analytics_daily_snapshots_tenant_lookup`);
    await queryRunner.query(`ALTER TABLE analytics_daily_snapshots DROP CONSTRAINT IF EXISTS analytics_daily_snapshots_tenant_id_fkey`);
    await queryRunner.query(`ALTER TABLE analytics_daily_snapshots ALTER COLUMN outlet_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE analytics_daily_snapshots DROP COLUMN IF EXISTS tenant_id`);
  }
}

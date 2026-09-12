import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantAnalyticsSnapshotConstraint1779400000000 implements MigrationInterface {
  name = 'AddTenantAnalyticsSnapshotConstraint1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE analytics_daily_snapshots
        ADD CONSTRAINT analytics_daily_snapshots_tenant_lookup_unique
        UNIQUE (tenant_id, business_date);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE analytics_daily_snapshots DROP CONSTRAINT IF EXISTS analytics_daily_snapshots_tenant_lookup_unique`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalyticsDailySnapshots1777100000000 implements MigrationInterface {
  name = 'CreateAnalyticsDailySnapshots1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE analytics_daily_snapshots (
        id BIGSERIAL PRIMARY KEY,
        outlet_id BIGINT NOT NULL,
        business_date DATE NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        payload JSONB NOT NULL,
        generated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_analytics_daily_snapshots_lookup
        ON analytics_daily_snapshots(outlet_id, business_date)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_daily_snapshots_date
        ON analytics_daily_snapshots(business_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS analytics_daily_snapshots');
  }
}

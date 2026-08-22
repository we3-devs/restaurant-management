import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persisted daily/weekly/monthly rollups of raw order/payment/kitchen/
 * wastage activity into actionable insight numbers — see
 * `modules/period-insights`. Unlike dashboard_*_cache (a rolling-window
 * cache that gets overwritten as the window slides), each row here is a
 * closed historical period that is written once and kept forever, so
 * trend queries over months of history are a single indexed range scan
 * instead of re-aggregating raw orders every time.
 */
export class CreatePeriodInsightsTable1773900000000 implements MigrationInterface {
  name = 'CreatePeriodInsightsTable1773900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE period_insights (
        id BIGSERIAL PRIMARY KEY,
        outlet_id BIGINT NOT NULL,
        period_type VARCHAR(10) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        period_label VARCHAR(60) NOT NULL,
        payload JSONB NOT NULL,
        computed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_period_insights_lookup
        ON period_insights(outlet_id, period_type, period_start);
      CREATE INDEX idx_period_insights_type_start
        ON period_insights(period_type, period_start);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS period_insights`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The dashboard's stats/charts/breakdown/inventory-activity endpoints used
 * to recompute everything from scratch on every request (20+ joined
 * aggregate queries across the 4 endpoints). These tables hold one
 * precomputed row per outlet (sentinel outlet_id = 0 for the "all outlets"
 * unfiltered view) for the dashboard's default date range, refreshed
 * event-driven on writes and reconciled nightly — see
 * `modules/dashboard-cache`. Reads become a single indexed lookup; custom
 * date ranges picked in the UI still compute live and never touch these
 * tables. Payloads are stored as JSONB (the literal endpoint response body)
 * rather than flattened columns, since the real response shapes are nested
 * objects/arrays that don't reduce to scalars.
 */
export class CreateDashboardCacheTables1772200000000
  implements MigrationInterface
{
  name = 'CreateDashboardCacheTables1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dashboard_stats_cache (
        outlet_id BIGINT PRIMARY KEY,
        range_from TIMESTAMP NOT NULL,
        range_to TIMESTAMP NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE dashboard_chart_cache (
        outlet_id BIGINT PRIMARY KEY,
        range_from TIMESTAMP NOT NULL,
        range_to TIMESTAMP NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE dashboard_breakdown_cache (
        outlet_id BIGINT PRIMARY KEY,
        range_from TIMESTAMP NOT NULL,
        range_to TIMESTAMP NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE dashboard_inventory_cache (
        outlet_id BIGINT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_dashboard_stats_cache_updated_at ON dashboard_stats_cache(updated_at);
      CREATE INDEX idx_dashboard_chart_cache_updated_at ON dashboard_chart_cache(updated_at);
      CREATE INDEX idx_dashboard_breakdown_cache_updated_at ON dashboard_breakdown_cache(updated_at);
      CREATE INDEX idx_dashboard_inventory_cache_updated_at ON dashboard_inventory_cache(updated_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard_inventory_cache`);
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard_breakdown_cache`);
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard_chart_cache`);
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard_stats_cache`);
  }
}

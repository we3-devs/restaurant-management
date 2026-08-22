import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BS (Bikram Sambat) counterpart of period_insights — see
 * `1773900000000-CreatePeriodInsightsTable.ts` and
 * `modules/period-insights/entities/period-insight-np.entity.ts`. Computed
 * on real Nepali calendar boundaries rather than relabeled AD ones, since
 * BS months/weeks don't align with AD months/weeks.
 */
export class CreatePeriodInsightsNpTable1774000000000 implements MigrationInterface {
  name = 'CreatePeriodInsightsNpTable1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE period_insights_np (
        id BIGSERIAL PRIMARY KEY,
        outlet_id BIGINT NOT NULL,
        period_type VARCHAR(10) NOT NULL,
        period_start_bs VARCHAR(10) NOT NULL,
        period_end_bs VARCHAR(10) NOT NULL,
        period_start_ad DATE NOT NULL,
        period_end_ad DATE NOT NULL,
        period_label VARCHAR(60) NOT NULL,
        payload JSONB NOT NULL,
        computed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_period_insights_np_lookup
        ON period_insights_np(outlet_id, period_type, period_start_bs);
      CREATE INDEX idx_period_insights_np_type_start
        ON period_insights_np(period_type, period_start_bs);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS period_insights_np`);
  }
}

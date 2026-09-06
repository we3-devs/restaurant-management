import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backs OrdersService#insertOrderWithBillNumber. The old implementation
 * derived bill_number from `orders.count()` for the current reset period —
 * two concurrent requests reading the same count before either insert
 * commits produce the same bill_number and collide against
 * orders_bill_number_key (23505). This table gives each (outlet, period) a
 * real atomic counter: the increment is a single `INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING` statement, so Postgres itself serializes concurrent
 * callers on the row instead of the application racing on a read-then-write
 * count.
 *
 * NOTE: this migration was already applied directly against the shared
 * database (it and its effects predate this file being restored to the
 * repo after being lost to an uncommitted-changes wipe) — `up()` here must
 * stay a byte-for-byte match of what actually ran, since TypeORM will skip
 * re-running any migration whose name already has a row in
 * typeorm_migrations, but a fresh environment running this file for the
 * first time still needs it to produce the real table.
 */
export class CreateBillNumberCounters1772800000000 implements MigrationInterface {
  name = 'CreateBillNumberCounters1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bill_number_counters (
        outlet_id BIGINT NOT NULL,
        period_key VARCHAR(32) NOT NULL,
        last_number INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY (outlet_id, period_key)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS bill_number_counters`);
  }
}

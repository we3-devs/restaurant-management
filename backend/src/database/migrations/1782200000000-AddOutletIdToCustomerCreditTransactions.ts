import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds outlet_id to customer_credit_transactions so a settlement (paying
 * down a customer's tab) can be attributed to an outlet and counted as
 * revenue for that outlet in the period it's actually collected — see
 * AnalyticsService#overview / DashboardComputeService#getSalesOverview,
 * which exclude a credit charge from revenue the moment it's put on the
 * tab (it isn't money collected yet) and need this column to add the
 * settlement back in once it is.
 *
 * Backfilled only for rows tied to an order (charge/refund_reversal) —
 * their outlet is unambiguous (the order's own outlet). Existing
 * settlement/adjustment rows have no order to backfill from and are left
 * null; they predate outlet attribution and can't be recovered.
 */
export class AddOutletIdToCustomerCreditTransactions1782200000000
  implements MigrationInterface
{
  name = 'AddOutletIdToCustomerCreditTransactions1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customer_credit_transactions
        ADD COLUMN IF NOT EXISTS outlet_id bigint REFERENCES outlets(id)
    `);

    await queryRunner.query(`
      UPDATE customer_credit_transactions t
      SET outlet_id = o.outlet_id
      FROM orders o
      WHERE t.order_id = o.id AND t.outlet_id IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_credit_transactions_outlet_created
        ON customer_credit_transactions (outlet_id, created_at)
        WHERE outlet_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_customer_credit_transactions_outlet_created`,
    );
    await queryRunner.query(
      `ALTER TABLE customer_credit_transactions DROP COLUMN IF EXISTS outlet_id`,
    );
  }
}

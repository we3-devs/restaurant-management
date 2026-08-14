import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceNumberAndCounters1771700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create invoice_number_counters table (mirrors bill_number_counters)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invoice_number_counters (
        id BIGSERIAL PRIMARY KEY,
        outlet_id BIGINT NOT NULL,
        period_key VARCHAR(255) NOT NULL,
        last_number INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(outlet_id, period_key)
      )
    `);

    // Add invoice columns to orders table
    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN invoice_number VARCHAR(255) UNIQUE NULL,
      ADD COLUMN invoice_generated_at TIMESTAMP NULL
    `);

    // Create index on invoice_number for faster lookups
    await queryRunner.query(`
      CREATE INDEX idx_orders_invoice_number ON orders(invoice_number) WHERE invoice_number IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_invoice_number`);

    // Remove invoice columns
    await queryRunner.query(`
      ALTER TABLE orders
      DROP COLUMN invoice_generated_at,
      DROP COLUMN invoice_number
    `);

    // Drop invoice_number_counters table
    await queryRunner.query(`DROP TABLE IF EXISTS invoice_number_counters`);
  }
}

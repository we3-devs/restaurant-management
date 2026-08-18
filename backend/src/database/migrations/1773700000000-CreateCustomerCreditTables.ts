import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerCreditTables1773700000000
  implements MigrationInterface
{
  name = 'CreateCustomerCreditTables1773700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customer_credit_accounts (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT UNIQUE NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        credit_limit DECIMAL(18,2) NOT NULL DEFAULT 0,
        outstanding_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
        lifetime_charged DECIMAL(18,2) NOT NULL DEFAULT 0,
        lifetime_settled DECIMAL(18,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE customer_credit_transactions (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(30) NOT NULL CHECK (type IN ('charge','settlement','adjustment','refund_reversal')),
        amount DECIMAL(18,2) NOT NULL,
        balance_after DECIMAL(18,2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_customer_credit_transactions_customer ON customer_credit_transactions(customer_id);
      CREATE INDEX idx_customer_credit_transactions_order ON customer_credit_transactions(order_id);
      CREATE INDEX idx_customer_credit_transactions_type ON customer_credit_transactions(type);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS customer_credit_transactions CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS customer_credit_accounts CASCADE`,
    );
  }
}

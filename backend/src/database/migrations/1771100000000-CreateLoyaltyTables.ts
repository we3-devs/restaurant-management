import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoyaltyTables1771100000000 implements MigrationInterface {
  name = 'CreateLoyaltyTables1771100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers ADD COLUMN date_of_birth DATE;
      ALTER TABLE customers ADD COLUMN welcome_bonus_granted BOOLEAN DEFAULT FALSE;
    `);

    await queryRunner.query(`
      CREATE TABLE loyalty_accounts (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT UNIQUE NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        current_points INTEGER NOT NULL DEFAULT 0,
        lifetime_earned INTEGER NOT NULL DEFAULT 0,
        lifetime_redeemed INTEGER NOT NULL DEFAULT 0,
        expiring_points INTEGER NOT NULL DEFAULT 0,
        tier VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE loyalty_transactions (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(30) NOT NULL CHECK (type IN ('earn','redeem','adjustment','expiry','refund_reversal')),
        points INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        source VARCHAR(100),
        notes TEXT,
        expires_at TIMESTAMP,
        is_expired BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
      CREATE INDEX idx_loyalty_transactions_order ON loyalty_transactions(order_id);
      CREATE INDEX idx_loyalty_transactions_type ON loyalty_transactions(type);
      CREATE INDEX idx_loyalty_transactions_expiry ON loyalty_transactions(expires_at) WHERE is_expired = FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS loyalty_transactions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS loyalty_accounts CASCADE`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS date_of_birth`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS welcome_bonus_granted`);
  }
}

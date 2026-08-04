import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the Redis-backed OTP flow (`SET NX EX` resend-lock, `SET EX` code,
 * `INCR`+`EXPIRE` attempt counter) with a Postgres table — see
 * CustomerAuthService. One row per identifier (phone/email); a fresh
 * `requestOtp()` call upserts it (guarded by `lock_until` for the resend
 * lock), `verifyOtp()` atomically increments `attempts` then atomically
 * deletes-and-returns the row only if the code matches and hasn't expired.
 */
export class CreateCustomerOtpsTable1772400000000
  implements MigrationInterface
{
  name = 'CreateCustomerOtpsTable1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customer_otps (
        identifier TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        lock_until TIMESTAMP NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_customer_otps_expires_at ON customer_otps(expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS customer_otps`);
  }
}

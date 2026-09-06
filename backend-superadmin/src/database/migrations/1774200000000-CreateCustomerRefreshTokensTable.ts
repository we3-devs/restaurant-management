import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds refresh-token rotation for the customer/guest auth flow, mirroring the
 * staff `refresh_tokens` table (see CreateAuthTables). Before this, the
 * customer/guest JWT was minted with no `expiresIn` and the browser cookie
 * lived for 10 years — a leaked token was valid forever with no revocation
 * path. Now the access token is short-lived and silently rotated against a
 * hashed, opaque refresh token stored here.
 *
 * `customer_id` is nullable: a `guest` session has no customer row, so its
 * refresh row carries only the JWT `payload` needed to re-mint an identical
 * access token. For `customer` sessions it is set so a suspected-theft event
 * can revoke the whole chain for that customer.
 */
export class CreateCustomerRefreshTokensTable1774200000000
  implements MigrationInterface
{
  name = 'CreateCustomerRefreshTokensTable1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customer_refresh_tokens (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT NULL REFERENCES customers(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        payload JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        replaced_by_token_hash VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_customer_refresh_tokens_customer_id ON customer_refresh_tokens(customer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_customer_refresh_tokens_expires_at ON customer_refresh_tokens(expires_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS customer_refresh_tokens`);
  }
}

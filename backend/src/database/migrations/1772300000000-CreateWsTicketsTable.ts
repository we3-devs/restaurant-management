import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the Redis-backed ws-ticket keyspace (`kds-ws-ticket:*` /
 * `guest-ws-ticket:*`, `SET ... EX 30` + `GET`+`DEL` on redeem) with a
 * Postgres table — see WsTicketsService. `redeem` is a single
 * `DELETE ... RETURNING`, so concurrent redeem attempts for the same ticket
 * still resolve to exactly one winner (Postgres serializes the two DELETEs).
 */
export class CreateWsTicketsTable1772300000000 implements MigrationInterface {
  name = 'CreateWsTicketsTable1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ws_tickets (
        ticket TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        payload JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ws_tickets_expires_at ON ws_tickets(expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ws_tickets`);
  }
}

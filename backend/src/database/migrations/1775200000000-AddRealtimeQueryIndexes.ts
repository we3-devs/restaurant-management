import { MigrationInterface, QueryRunner } from 'typeorm';

/** Indexes the outlet/status/foreign-key predicates used by POS, KDS, floor and guest queries. */
export class AddRealtimeQueryIndexes1775200000000 implements MigrationInterface {
  name = 'AddRealtimeQueryIndexes1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created ON orders (outlet_id, status, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_table_session_created ON orders (table_session_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_status ON order_items (order_id, status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_outlet_status_created ON kitchen_tickets (outlet_id, status, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_kitchen_ticket_items_ticket_status ON kitchen_ticket_items (ticket_id, status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_table_sessions_outlet_status ON table_sessions (outlet_id, status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_reservations_outlet_date_status ON reservations (outlet_id, reserved_at, status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reservations_outlet_date_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_table_sessions_outlet_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_kitchen_ticket_items_ticket_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_kitchen_tickets_outlet_status_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_items_order_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_table_session_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_outlet_status_created`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops kitchen_ticket_items.status, which was a hand-maintained copy of
 * order_items.status kept in step by app code alone — every transition had to
 * remember to write both, and nothing but programmer discipline stopped the
 * two from disagreeing.
 *
 * A kitchen_ticket_item is 1:1 with an order_item, so the status was always
 * derivable: the service now reads it through the orderItem relation and the
 * API still exposes the same `status` field on the wire, so the KDS board is
 * unchanged. The item's own timing columns (started_at/ready_at/served_at/
 * recalled_at/recall_count) stay — those are ticket facts, not duplicated
 * state.
 */
export class DropKitchenTicketItemStatusMirror1781600000000
  implements MigrationInterface
{
  name = 'DropKitchenTicketItemStatusMirror1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE kitchen_ticket_items DROP COLUMN IF EXISTS status`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE kitchen_ticket_items ADD COLUMN status varchar(255) NOT NULL DEFAULT 'sent_to_kitchen'`,
    );
    await queryRunner.query(`
      UPDATE kitchen_ticket_items kti
      SET status = oi.status
      FROM order_items oi
      WHERE oi.id = kti.order_item_id
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Last line of defense for "a completed order can never be modified again" —
 * the service layer already rejects this (OrdersService.assertMutable,
 * called from every mutation entry point), but that only holds as long as
 * every future code path remembers to call it. This makes the same rule
 * impossible to violate even via a raw query, a forgotten guard, or a
 * migration/backfill script.
 *
 * Two triggers:
 *  - orders_lock_completed: once a row's status is 'completed', blocks any
 *    further UPDATE to that row (including trying to change status again —
 *    consistent with ORDER_STATUS_TRANSITIONS already treating 'completed'
 *    as terminal at the application layer).
 *  - order_child_lock_completed: blocks INSERT/UPDATE/DELETE on the
 *    resources that compose an order (items, item addons, order-table
 *    assignments, payments) whenever their parent order is completed.
 */
export class LockCompletedOrders1771900000000 implements MigrationInterface {
  name = 'LockCompletedOrders1771900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_completed_order_update()
      RETURNS trigger AS $$
      BEGIN
        IF OLD.status = 'completed' THEN
          RAISE EXCEPTION 'Order % is completed and can no longer be modified', OLD.id
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS orders_lock_completed ON orders;
      CREATE TRIGGER orders_lock_completed
        BEFORE UPDATE ON orders
        FOR EACH ROW
        EXECUTE FUNCTION prevent_completed_order_update();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_completed_order_child_mutation()
      RETURNS trigger AS $$
      DECLARE
        target_order_id bigint;
        order_status varchar;
      BEGIN
        target_order_id := COALESCE(NEW.order_id, OLD.order_id);
        SELECT status INTO order_status FROM orders WHERE id = target_order_id;
        IF order_status = 'completed' THEN
          RAISE EXCEPTION 'Order % is completed and can no longer be modified', target_order_id
            USING ERRCODE = '23514';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
    for (const table of ['order_items', 'order_tables', 'order_payments']) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS ${table}_lock_completed_order ON ${table}`,
      );
      await queryRunner.query(`
        CREATE TRIGGER ${table}_lock_completed_order
          BEFORE INSERT OR UPDATE OR DELETE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION prevent_completed_order_child_mutation();
      `);
    }

    // order_item_addons hangs off order_item_id, not order_id directly, so it
    // needs its own trigger function to resolve the order via order_items.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_completed_order_item_addon_mutation()
      RETURNS trigger AS $$
      DECLARE
        target_item_id bigint;
        order_status varchar;
      BEGIN
        target_item_id := COALESCE(NEW.order_item_id, OLD.order_item_id);
        SELECT o.status INTO order_status
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          WHERE oi.id = target_item_id;
        IF order_status = 'completed' THEN
          RAISE EXCEPTION 'Order item % belongs to a completed order and can no longer be modified', target_item_id
            USING ERRCODE = '23514';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS order_item_addons_lock_completed_order ON order_item_addons`,
    );
    await queryRunner.query(`
      CREATE TRIGGER order_item_addons_lock_completed_order
        BEFORE INSERT OR UPDATE OR DELETE ON order_item_addons
        FOR EACH ROW
        EXECUTE FUNCTION prevent_completed_order_item_addon_mutation();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS order_item_addons_lock_completed_order ON order_item_addons`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_completed_order_item_addon_mutation()`,
    );
    for (const table of ['order_items', 'order_tables', 'order_payments']) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS ${table}_lock_completed_order ON ${table}`,
      );
    }
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_completed_order_child_mutation()`,
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS orders_lock_completed ON orders`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_completed_order_update()`,
    );
  }
}

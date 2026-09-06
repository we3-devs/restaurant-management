import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncOrderPaymentTotals1776000000000 implements MigrationInterface {
  name = 'SyncOrderPaymentTotals1776000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Completed orders are immutable, except for the existing invoice fields.
    // Payment totals are projections of order_payments, so allow this migration
    // (and the payment sync trigger below) to update only those projection
    // fields while keeping every business field locked.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_completed_order_update()
      RETURNS trigger AS $$
      BEGIN
        IF OLD.status = 'completed' THEN
          IF NEW.id IS NOT DISTINCT FROM OLD.id AND
             NEW.outlet_id IS NOT DISTINCT FROM OLD.outlet_id AND
             NEW.reservation_id IS NOT DISTINCT FROM OLD.reservation_id AND
             NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id AND
             NEW.table_session_id IS NOT DISTINCT FROM OLD.table_session_id AND
             NEW.created_by IS NOT DISTINCT FROM OLD.created_by AND
             NEW.updated_by IS NOT DISTINCT FROM OLD.updated_by AND
             NEW.cancelled_by IS NOT DISTINCT FROM OLD.cancelled_by AND
             NEW.order_number IS NOT DISTINCT FROM OLD.order_number AND
             NEW.bill_id IS NOT DISTINCT FROM OLD.bill_id AND
             NEW.bill_number IS NOT DISTINCT FROM OLD.bill_number AND
             NEW.order_type IS NOT DISTINCT FROM OLD.order_type AND
             NEW.source IS NOT DISTINCT FROM OLD.source AND
             NEW.order_source IS NOT DISTINCT FROM OLD.order_source AND
             NEW.status IS NOT DISTINCT FROM OLD.status AND
             NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status AND
             NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at AND
             NEW.cancelled_at IS NOT DISTINCT FROM OLD.cancelled_at AND
             NEW.note IS NOT DISTINCT FROM OLD.note AND
             NEW.cancel_reason IS NOT DISTINCT FROM OLD.cancel_reason AND
             NEW.subtotal IS NOT DISTINCT FROM OLD.subtotal AND
             NEW.discount_type IS NOT DISTINCT FROM OLD.discount_type AND
             NEW.discount_value IS NOT DISTINCT FROM OLD.discount_value AND
             NEW.discount_amount IS NOT DISTINCT FROM OLD.discount_amount AND
             NEW.service_charge_amount IS NOT DISTINCT FROM OLD.service_charge_amount AND
             NEW.tax_amount IS NOT DISTINCT FROM OLD.tax_amount AND
             NEW.grand_total IS NOT DISTINCT FROM OLD.grand_total AND
             NEW.loyalty_points_earned IS NOT DISTINCT FROM OLD.loyalty_points_earned AND
             NEW.loyalty_points_redeemed IS NOT DISTINCT FROM OLD.loyalty_points_redeemed AND
             NEW.loyalty_discount_amount IS NOT DISTINCT FROM OLD.loyalty_discount_amount THEN
            RETURN NEW;
          END IF;

          RAISE EXCEPTION 'Order % is completed and can no longer be modified', OLD.id
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION recalculate_order_payment_totals(target_order_id bigint)
      RETURNS void LANGUAGE plpgsql AS $function$
      DECLARE
        order_total numeric;
        gross_paid numeric;
        total_refunded numeric;
        net_paid numeric;
      BEGIN
        SELECT grand_total INTO order_total FROM orders WHERE id = target_order_id FOR UPDATE;
        IF NOT FOUND THEN RETURN; END IF;

        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'payment'), 0),
          COALESCE(SUM(amount) FILTER (WHERE type = 'refund'), 0)
        INTO gross_paid, total_refunded
        FROM order_payments
        WHERE order_id = target_order_id AND status = 'completed';

        net_paid := ROUND(gross_paid - total_refunded, 2);

        UPDATE orders
        SET paid_amount = net_paid,
            refunded_amount = ROUND(total_refunded, 2),
            due_amount = GREATEST(ROUND(order_total - net_paid, 2), 0),
            payment_status = CASE
              WHEN total_refunded > 0 AND total_refunded >= gross_paid THEN 'refunded'
              WHEN net_paid <= 0 THEN 'unpaid'
              WHEN net_paid >= order_total THEN 'paid'
              ELSE 'partial'
            END,
            updated_at = now()
        WHERE id = target_order_id;
      END;
      $function$;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_order_payment_totals_from_payment()
      RETURNS trigger LANGUAGE plpgsql AS $function$
      BEGIN
        PERFORM recalculate_order_payment_totals(CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END);
        IF TG_OP = 'UPDATE' AND OLD.order_id IS DISTINCT FROM NEW.order_id THEN
          PERFORM recalculate_order_payment_totals(OLD.order_id);
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $function$;
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS sync_order_payment_totals ON order_payments`);
    await queryRunner.query(`CREATE TRIGGER sync_order_payment_totals AFTER INSERT OR UPDATE OR DELETE ON order_payments FOR EACH ROW EXECUTE FUNCTION sync_order_payment_totals_from_payment()`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_order_payment_totals_from_order()
      RETURNS trigger LANGUAGE plpgsql AS $function$
      BEGIN
        IF NEW.grand_total IS DISTINCT FROM OLD.grand_total THEN
          PERFORM recalculate_order_payment_totals(NEW.id);
        END IF;
        RETURN NEW;
      END;
      $function$;
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS sync_order_payment_totals_from_order ON orders`);
    await queryRunner.query(`CREATE TRIGGER sync_order_payment_totals_from_order AFTER UPDATE OF grand_total ON orders FOR EACH ROW EXECUTE FUNCTION sync_order_payment_totals_from_order()`);
    await queryRunner.query(`
      UPDATE orders o
      SET paid_amount = totals.net_paid,
          refunded_amount = totals.refunded_amount,
          due_amount = GREATEST(ROUND(o.grand_total - totals.net_paid, 2), 0),
          payment_status = CASE
            WHEN totals.refunded_amount > 0 AND totals.refunded_amount >= totals.gross_paid THEN 'refunded'
            WHEN totals.net_paid <= 0 THEN 'unpaid'
            WHEN totals.net_paid >= o.grand_total THEN 'paid'
            ELSE 'partial'
          END
      FROM (
        SELECT order_id,
          ROUND(COALESCE(SUM(amount) FILTER (WHERE type = 'payment'), 0), 2) AS gross_paid,
          ROUND(COALESCE(SUM(amount) FILTER (WHERE type = 'refund'), 0), 2) AS refunded_amount,
          ROUND(COALESCE(SUM(amount) FILTER (WHERE type = 'payment'), 0) - COALESCE(SUM(amount) FILTER (WHERE type = 'refund'), 0), 2) AS net_paid
        FROM order_payments WHERE status = 'completed' GROUP BY order_id
      ) totals WHERE o.id = totals.order_id
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS sync_order_payment_totals ON order_payments`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS sync_order_payment_totals_from_order ON orders`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_order_payment_totals_from_payment()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_order_payment_totals_from_order()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS recalculate_order_payment_totals(bigint)`);
  }
}

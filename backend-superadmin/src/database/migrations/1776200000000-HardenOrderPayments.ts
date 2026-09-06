import { MigrationInterface, QueryRunner } from 'typeorm';

/** Makes the payment ledger safe to retry and keeps completed-order refunds auditable. */
export class HardenOrderPayments1776200000000 implements MigrationInterface {
  name = 'HardenOrderPayments1776200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE order_payments
        ADD COLUMN IF NOT EXISTS idempotency_key varchar(100)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_order_payments_outlet_idempotency
        ON order_payments (outlet_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_payments_order_status_paid_at
        ON order_payments (order_id, status, paid_at)
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE order_payments ADD CONSTRAINT order_payments_amount_positive CHECK (amount > 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // Completed orders remain immutable, except for an auditable refund insert.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_completed_order_child_mutation()
      RETURNS trigger AS $$
      DECLARE target_order_id bigint; order_status varchar;
      BEGIN
        target_order_id := COALESCE(NEW.order_id, OLD.order_id);
        SELECT status INTO order_status FROM orders WHERE id = target_order_id;
        IF order_status = 'completed' THEN
          -- NEW is a generic trigger record. Only read NEW.type inside the
          -- order_payments branch; other child tables do not have that field.
          IF TG_TABLE_NAME = 'order_payments' THEN
            IF TG_OP = 'INSERT' AND NEW.type = 'refund' THEN
              RETURN NEW;
            END IF;
          END IF;
          RAISE EXCEPTION 'Order % is completed and can no longer be modified', target_order_id
            USING ERRCODE = '23514';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // The denormalized payment projection is allowed to change during a refund;
    // every other completed-order field still must remain byte-for-byte stable.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_completed_order_update()
      RETURNS trigger AS $$ BEGIN
        IF OLD.status = 'completed' THEN
          IF NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.outlet_id IS NOT DISTINCT FROM OLD.outlet_id
             AND NEW.reservation_id IS NOT DISTINCT FROM OLD.reservation_id AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id
             AND NEW.table_session_id IS NOT DISTINCT FROM OLD.table_session_id AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
             AND NEW.updated_by IS NOT DISTINCT FROM OLD.updated_by AND NEW.cancelled_by IS NOT DISTINCT FROM OLD.cancelled_by
             AND NEW.order_number IS NOT DISTINCT FROM OLD.order_number AND NEW.bill_id IS NOT DISTINCT FROM OLD.bill_id
             AND NEW.bill_number IS NOT DISTINCT FROM OLD.bill_number AND NEW.order_type IS NOT DISTINCT FROM OLD.order_type
             AND NEW.source IS NOT DISTINCT FROM OLD.source AND NEW.order_source IS NOT DISTINCT FROM OLD.order_source
             AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status
             AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at AND NEW.cancelled_at IS NOT DISTINCT FROM OLD.cancelled_at
             AND NEW.note IS NOT DISTINCT FROM OLD.note AND NEW.cancel_reason IS NOT DISTINCT FROM OLD.cancel_reason
             AND NEW.subtotal IS NOT DISTINCT FROM OLD.subtotal AND NEW.discount_type IS NOT DISTINCT FROM OLD.discount_type
             AND NEW.discount_value IS NOT DISTINCT FROM OLD.discount_value AND NEW.discount_amount IS NOT DISTINCT FROM OLD.discount_amount
             AND NEW.service_charge_amount IS NOT DISTINCT FROM OLD.service_charge_amount AND NEW.grand_total IS NOT DISTINCT FROM OLD.grand_total
             AND NEW.loyalty_points_earned IS NOT DISTINCT FROM OLD.loyalty_points_earned
             AND NEW.loyalty_points_redeemed IS NOT DISTINCT FROM OLD.loyalty_points_redeemed
             AND NEW.loyalty_discount_amount IS NOT DISTINCT FROM OLD.loyalty_discount_amount
             AND NEW.updated_at IS DISTINCT FROM OLD.updated_at
          THEN RETURN NEW; END IF;
          RAISE EXCEPTION 'Order % is completed and can no longer be modified', OLD.id USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_payments_order_status_paid_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_order_payments_outlet_idempotency`);
    await queryRunner.query(`ALTER TABLE order_payments DROP COLUMN IF EXISTS idempotency_key`);
  }
}

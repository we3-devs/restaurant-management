import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fixes the generic child trigger reading NEW.type on non-payment tables. */
export class FixCompletedOrderChildTrigger1776300000000 implements MigrationInterface {
  name = 'FixCompletedOrderChildTrigger1776300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
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
          -- NEW is a generic trigger record. Do not access NEW.type unless
          -- this trigger is executing for order_payments.
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
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // The previous function is unsafe because it reads NEW.type for every
    // child table; leave the repaired function installed on downgrade.
  }
}

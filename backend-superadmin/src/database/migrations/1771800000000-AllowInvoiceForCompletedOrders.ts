import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow invoice generation for completed orders — invoiceNumber and
 * invoiceGeneratedAt can be set on completed orders, but no other fields.
 * This is safe because invoices are read-only billing documents that can be
 * generated anytime after an order is complete.
 */
export class AllowInvoiceForCompletedOrders1771800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update the prevent_completed_order_update function to allow invoice fields
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_completed_order_update()
      RETURNS trigger AS $$
      BEGIN
        IF OLD.status = 'completed' THEN
          -- Allow updates only to invoiceNumber and invoiceGeneratedAt
          IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
             NEW.invoice_generated_at IS DISTINCT FROM OLD.invoice_generated_at THEN
            -- Check if only these fields are being changed
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
               NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status AND
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
               NEW.paid_amount IS NOT DISTINCT FROM OLD.paid_amount AND
               NEW.due_amount IS NOT DISTINCT FROM OLD.due_amount AND
               NEW.refunded_amount IS NOT DISTINCT FROM OLD.refunded_amount AND
               NEW.loyalty_points_earned IS NOT DISTINCT FROM OLD.loyalty_points_earned AND
               NEW.loyalty_points_redeemed IS NOT DISTINCT FROM OLD.loyalty_points_redeemed AND
               NEW.loyalty_discount_amount IS NOT DISTINCT FROM OLD.loyalty_discount_amount THEN
              -- Only invoice fields changed, allow it
              RETURN NEW;
            END IF;
          END IF;
          -- Any other update to completed order is blocked
          RAISE EXCEPTION 'Order % is completed and can no longer be modified', OLD.id
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to original stricter function
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
  }
}

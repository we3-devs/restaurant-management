import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `orders.order_number` is the internal reference (`ORD-{outletId}-{ts}-{rand}`)
 * used in URLs/API lookups and never meant to be read by a guest. This adds
 * a separate, guest-facing `bill_number` — human-readable, formatted per the
 * "pos" settings category (prefix/digits/reset-period — see
 * OrdersService#generateBillNumber) — without touching order_number's shape
 * or its existing unique constraint/usages. Nullable + backfill-free:
 * existing orders simply have no bill_number and fall back to orderNumber
 * in the UI (see BillView).
 */
export class AddBillNumberToOrders1772000000000 implements MigrationInterface {
  name = 'AddBillNumberToOrders1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN bill_number VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ADD CONSTRAINT orders_bill_number_key UNIQUE (bill_number)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_bill_number_key`,
    );
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS bill_number`,
    );
  }
}

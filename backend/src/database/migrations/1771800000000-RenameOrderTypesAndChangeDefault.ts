import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames order_type values to reflect actual sale-entry workflow instead of
 * unused dine_in/takeaway/delivery metadata: dine_in -> table (requires a
 * table session), takeaway -> grab_and_go (no table, quick counter sale).
 * delivery is untouched — it stays a distinct type (no customer physically
 * present). A brand-new 'stay' type (customer waits around without a
 * tracked table, e.g. bar/counter) has no old equivalent, so down() maps it
 * back to 'dine_in' as the closest fit — an accepted lossy edge.
 *
 * The original Laravel schema left a CHECK constraint on this column
 * (orders_order_type_check, restricted to dine_in/takeaway/delivery) that
 * isn't tracked by any TypeORM migration — must be dropped before the
 * remap and recreated with the new allowed values.
 */
export class RenameOrderTypesAndChangeDefault1771800000000
  implements MigrationInterface
{
  name = 'RenameOrderTypesAndChangeDefault1771800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check`,
    );
    await queryRunner.query(
      `UPDATE orders SET order_type = 'table' WHERE order_type = 'dine_in'`,
    );
    await queryRunner.query(
      `UPDATE orders SET order_type = 'grab_and_go' WHERE order_type = 'takeaway'`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
       CHECK (order_type IN ('grab_and_go', 'table', 'stay', 'delivery'))`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ALTER COLUMN order_type SET DEFAULT 'table'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check`,
    );
    await queryRunner.query(
      `UPDATE orders SET order_type = 'dine_in' WHERE order_type IN ('table', 'stay')`,
    );
    await queryRunner.query(
      `UPDATE orders SET order_type = 'takeaway' WHERE order_type = 'grab_and_go'`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
       CHECK (order_type IN ('dine_in', 'takeaway', 'delivery'))`,
    );
    await queryRunner.query(
      `ALTER TABLE orders ALTER COLUMN order_type SET DEFAULT 'dine_in'`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeBillNumberToUuid1771500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Generate UUIDs for any existing null bill_numbers, excluding completed orders
    await queryRunner.query(`
      UPDATE orders
      SET bill_number = gen_random_uuid()::text
      WHERE bill_number IS NULL AND status != 'completed'
    `);

    // Drop the existing unique constraint
    await queryRunner.query(
      `ALTER TABLE orders DROP CONSTRAINT IF EXISTS "orders_bill_number_key"`,
    );

    // For completed orders with null bill_number, use order_number as fallback UUID
    await queryRunner.query(`
      UPDATE orders
      SET bill_number = md5(order_number)::uuid
      WHERE bill_number IS NULL AND status = 'completed'
    `);

    // Change column type to UUID and make it NOT NULL
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN bill_number TYPE uuid USING bill_number::uuid,
      ALTER COLUMN bill_number SET NOT NULL
    `);

    // Re-create unique constraint on the UUID column
    await queryRunner.query(
      `ALTER TABLE orders ADD CONSTRAINT "orders_bill_number_key" UNIQUE (bill_number)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint
    await queryRunner.query(
      `ALTER TABLE orders DROP CONSTRAINT IF EXISTS "orders_bill_number_key"`,
    );

    // Revert column type back to varchar
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN bill_number TYPE varchar(255),
      ALTER COLUMN bill_number DROP NOT NULL
    `);

    // Re-create unique constraint on the varchar column
    await queryRunner.query(
      `ALTER TABLE orders ADD CONSTRAINT "orders_bill_number_key" UNIQUE (bill_number)`,
    );
  }
}

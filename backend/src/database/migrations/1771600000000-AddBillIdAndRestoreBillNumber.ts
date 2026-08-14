import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillIdAndRestoreBillNumber1771600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add billId column as UUID
    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN bill_id uuid UNIQUE NOT NULL DEFAULT gen_random_uuid()
    `);

    // Change bill_number back to varchar and allow NULL (guest-facing formatted number)
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN bill_number TYPE varchar(255),
      ALTER COLUMN bill_number DROP NOT NULL,
      ALTER COLUMN bill_number SET DEFAULT NULL
    `);

    // Update existing bill_number values (convert UUIDs back to NULL)
    await queryRunner.query(`
      UPDATE orders
      SET bill_number = NULL
      WHERE bill_number ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);

    // Remove old unique constraint and re-add it (allows NULL values)
    await queryRunner.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS "orders_bill_number_key"
    `);

    await queryRunner.query(`
      ALTER TABLE orders ADD CONSTRAINT "orders_bill_number_key" UNIQUE (bill_number)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop bill_id column
    await queryRunner.query(`
      ALTER TABLE orders DROP COLUMN bill_id
    `);

    // Restore bill_number to UUID NOT NULL
    await queryRunner.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS "orders_bill_number_key"
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN bill_number SET NOT NULL,
      ALTER COLUMN bill_number DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE orders ADD CONSTRAINT "orders_bill_number_key" UNIQUE (bill_number)
    `);
  }
}

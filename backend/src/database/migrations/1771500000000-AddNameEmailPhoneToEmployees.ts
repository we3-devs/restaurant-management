import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Employee entity has declared name/email/phone columns since the
 * employees table was first created, but the original migration
 * (CreateStaffManagementTables) never included them — every employee
 * create/search that touches these fields has been failing at the DB level.
 * Table is empty in every environment audited, so this backfills nothing.
 */
export class AddNameEmailPhoneToEmployees1771500000000 implements MigrationInterface {
  name = 'AddNameEmailPhoneToEmployees1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees
      ADD COLUMN name VARCHAR(500) NOT NULL DEFAULT '',
      ADD COLUMN email VARCHAR(255),
      ADD COLUMN phone VARCHAR(100)
    `);
    await queryRunner.query(`ALTER TABLE employees ALTER COLUMN name DROP DEFAULT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees
      DROP COLUMN IF EXISTS name,
      DROP COLUMN IF EXISTS email,
      DROP COLUMN IF EXISTS phone
    `);
  }
}

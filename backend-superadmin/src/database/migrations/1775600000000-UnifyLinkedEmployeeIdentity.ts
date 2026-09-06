import { MigrationInterface, QueryRunner } from 'typeorm';

/** Backfills the denormalized employee identity columns from the canonical users table. */
export class UnifyLinkedEmployeeIdentity1775600000000 implements MigrationInterface {
  name = 'UnifyLinkedEmployeeIdentity1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE employees e
      SET name = u.name, email = u.email, phone = u.phone
      FROM users u
      WHERE e.user_id = u.id
    `);
  }

  public async down(): Promise<void> {
    // The old duplicated values cannot be recovered safely after this migration.
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTenantRoleUniqueIndexes1778400000000 implements MigrationInterface {
  name = 'FixTenantRoleUniqueIndexes1778400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_slug_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS roles_slug_unique`);
    await queryRunner.query(`ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_slug_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS roles_slug_key`);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // The tenant-scoped and global-template partial unique indexes remain the
    // intended constraints; restoring a global slug constraint would break
    // tenant role isolation.
  }
}

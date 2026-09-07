import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeriveAccessFromEmployeePositions1778600000000 implements MigrationInterface {
  name = 'DeriveAccessFromEmployeePositions1778600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // User access is now resolved from employees.position_id ->
    // positions.default_role_id -> role_permissions. The old assignments are
    // no longer part of authorization.
    await queryRunner.query(`DELETE FROM user_role_assignments`);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Deleted assignments cannot be reconstructed safely.
  }
}

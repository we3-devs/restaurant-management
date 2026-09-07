import { MigrationInterface, QueryRunner } from 'typeorm';

export class RolesAssignedThroughPositions1778500000000 implements MigrationInterface {
  name = 'RolesAssignedThroughPositions1778500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE roles SET is_assignable = false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE roles SET is_assignable = true`);
  }
}

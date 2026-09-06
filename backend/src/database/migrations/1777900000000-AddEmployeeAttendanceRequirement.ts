import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeAttendanceRequirement1777900000000 implements MigrationInterface {
  name = 'AddEmployeeAttendanceRequirement1777900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS requires_attendance BOOLEAN NOT NULL DEFAULT TRUE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS requires_attendance`);
  }
}

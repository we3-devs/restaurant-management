import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantAttendanceRequirement1778200000000 implements MigrationInterface {
  name = 'TenantAttendanceRequirement1778200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS attendance_required BOOLEAN NOT NULL DEFAULT false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS attendance_required`);
  }
}

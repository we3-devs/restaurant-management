import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoreAttendanceQrTokens1777000000000 implements MigrationInterface {
  name = 'StoreAttendanceQrTokens1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE attendance_qr_stations ADD COLUMN token VARCHAR(255) NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE attendance_qr_stations DROP COLUMN token');
  }
}

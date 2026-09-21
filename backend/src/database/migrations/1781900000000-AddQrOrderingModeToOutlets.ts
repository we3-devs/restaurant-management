import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrOrderingModeToOutlets1781900000000 implements MigrationInterface {
  name = 'AddQrOrderingModeToOutlets1781900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS qr_ordering_mode VARCHAR(20) NOT NULL DEFAULT 'login'`);
    await queryRunner.query(`ALTER TABLE outlets ADD CONSTRAINT outlets_qr_ordering_mode_check CHECK (qr_ordering_mode IN ('login', 'quick_order'))`);
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS qr_access_check_mode VARCHAR(20) NOT NULL DEFAULT 'either'`);
    await queryRunner.query(`ALTER TABLE outlets ADD CONSTRAINT outlets_qr_access_check_mode_check CHECK (qr_access_check_mode IN ('ip', 'geofence', 'either', 'both'))`);
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS qr_access_latitude NUMERIC(9,6)`);
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS qr_access_longitude NUMERIC(9,6)`);
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS qr_access_radius_meters INTEGER`);
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS qr_access_allowed_ip VARCHAR(45)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS qr_access_allowed_ip`);
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS qr_access_radius_meters`);
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS qr_access_longitude`);
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS qr_access_latitude`);
    await queryRunner.query(`ALTER TABLE outlets DROP CONSTRAINT IF EXISTS outlets_qr_access_check_mode_check`);
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS qr_access_check_mode`);
    await queryRunner.query(`ALTER TABLE outlets DROP CONSTRAINT IF EXISTS outlets_qr_ordering_mode_check`);
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS qr_ordering_mode`);
  }
}

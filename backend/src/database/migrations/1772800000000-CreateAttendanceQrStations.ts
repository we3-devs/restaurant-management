import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendanceQrStations1772800000000 implements MigrationInterface {
  name = 'CreateAttendanceQrStations1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendance_qr_stations (
        id BIGSERIAL PRIMARY KEY,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL CHECK (action IN ('clock-in', 'clock-out')),
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (outlet_id, action)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS attendance_qr_stations');
  }
}

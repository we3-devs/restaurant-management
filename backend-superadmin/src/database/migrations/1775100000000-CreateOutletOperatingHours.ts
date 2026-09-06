import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutletOperatingHours1775100000000 implements MigrationInterface {
  name = 'CreateOutletOperatingHours1775100000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE outlet_operating_hours (id BIGSERIAL PRIMARY KEY, outlet_id BIGINT NOT NULL UNIQUE REFERENCES outlets(id) ON DELETE CASCADE, opening_time TIME NULL, closing_time TIME NULL, timezone VARCHAR(100) NULL, enabled BOOLEAN NOT NULL DEFAULT false, last_closing_boundary_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now())`);
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query('DROP TABLE IF EXISTS outlet_operating_hours'); }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultRoleToPositions1771400000000 implements MigrationInterface {
  name = 'AddDefaultRoleToPositions1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE positions
      ADD COLUMN default_role_id BIGINT REFERENCES roles(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_positions_default_role ON positions(default_role_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_positions_default_role`);
    await queryRunner.query(`ALTER TABLE positions DROP COLUMN IF EXISTS default_role_id`);
  }
}

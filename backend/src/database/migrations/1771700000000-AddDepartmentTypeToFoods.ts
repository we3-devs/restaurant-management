import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepartmentTypeToFoods1771700000000 implements MigrationInterface {
  name = 'AddDepartmentTypeToFoods1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE foods ADD COLUMN department_type VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS department_type`);
  }
}

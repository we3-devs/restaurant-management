import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLegacyEmployeeDepartmentId1776600000000 implements MigrationInterface {
  name = 'RemoveLegacyEmployeeDepartmentId1776600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Preserve the old single assignment before removing the legacy column.
    await queryRunner.query(`
      INSERT INTO employee_department_assignments (employee_id, department_id)
      SELECT e.id, e.department_id
      FROM employees e
      WHERE e.department_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM outlet_departments d WHERE d.id = e.department_id AND d.outlet_id = e.outlet_id)
      ON CONFLICT (employee_id, department_id) DO NOTHING
    `);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS department_id`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES outlet_departments(id) ON DELETE SET NULL`);
  }
}

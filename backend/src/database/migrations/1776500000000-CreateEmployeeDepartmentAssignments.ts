import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeeDepartmentAssignments1776500000000 implements MigrationInterface {
  name = 'CreateEmployeeDepartmentAssignments1776500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS employee_department_assignments (id BIGSERIAL PRIMARY KEY, employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, department_id BIGINT NOT NULL REFERENCES outlet_departments(id) ON DELETE CASCADE, assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(employee_id, department_id))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS employee_department_assignments_employee_idx ON employee_department_assignments(employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS employee_department_assignments_department_idx ON employee_department_assignments(department_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employee_department_assignments`);
  }
}

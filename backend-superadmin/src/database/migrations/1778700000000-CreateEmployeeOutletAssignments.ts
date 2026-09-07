import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeeOutletAssignments1778700000000 implements MigrationInterface {
  name = 'CreateEmployeeOutletAssignments1778700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS employee_outlet_assignments (id BIGSERIAL PRIMARY KEY, employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE, assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(employee_id, outlet_id))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS employee_outlet_assignments_employee_idx ON employee_outlet_assignments(employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS employee_outlet_assignments_outlet_idx ON employee_outlet_assignments(outlet_id)`);
    await queryRunner.query(`INSERT INTO employee_outlet_assignments (employee_id, outlet_id) SELECT id, outlet_id FROM employees ON CONFLICT (employee_id, outlet_id) DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employee_outlet_assignments`);
  }
}

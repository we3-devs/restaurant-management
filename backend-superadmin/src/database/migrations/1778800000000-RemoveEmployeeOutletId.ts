import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveEmployeeOutletId1778800000000 implements MigrationInterface {
  name = 'RemoveEmployeeOutletId1778800000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    // Tenant ownership added a trigger and composite FK that both depend on
    // employees.outlet_id. Remove those dependencies before dropping the
    // legacy single-outlet column.
    await queryRunner.query(`DROP TRIGGER IF EXISTS employees_tenant_id_trigger ON employees`);
    await queryRunner.query(`ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_tenant_outlet_fkey`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS outlet_id`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id) ON DELETE CASCADE`);
    await queryRunner.query(`UPDATE employees e SET outlet_id = a.outlet_id FROM (SELECT DISTINCT ON (employee_id) employee_id, outlet_id FROM employee_outlet_assignments WHERE is_active = true ORDER BY employee_id, created_at) a WHERE a.employee_id = e.id`);
    await queryRunner.query(`ALTER TABLE employees ADD CONSTRAINT employees_tenant_outlet_fkey FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets (tenant_id, id)`);
    await queryRunner.query(`CREATE TRIGGER employees_tenant_id_trigger BEFORE INSERT OR UPDATE OF outlet_id ON employees FOR EACH ROW EXECUTE FUNCTION set_outlet_table_tenant_id()`);
  }
}

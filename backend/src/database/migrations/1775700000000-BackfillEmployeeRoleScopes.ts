import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ensures existing linked employees have the role scope implied by their position. */
export class BackfillEmployeeRoleScopes1775700000000 implements MigrationInterface {
  name = 'BackfillEmployeeRoleScopes1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO user_role_assignments
        (user_id, role_id, scope_type, outlet_id, outlet_department_id, warehouse_id, is_active)
      SELECT
        e.user_id,
        p.default_role_id,
        CASE WHEN r.level = 'global' THEN 'global' ELSE 'outlet' END,
        CASE WHEN r.level = 'global' THEN NULL ELSE e.outlet_id END,
        CASE WHEN r.level = 'global' THEN NULL ELSE e.department_id END,
        NULL,
        TRUE
      FROM employees e
      JOIN positions p ON p.id = e.position_id AND p.default_role_id IS NOT NULL
      JOIN roles r ON r.id = p.default_role_id
      WHERE e.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM user_role_assignments ura
          WHERE ura.user_id = e.user_id
            AND ura.role_id = p.default_role_id
            AND ura.scope_type = CASE WHEN r.level = 'global' THEN 'global' ELSE 'outlet' END
            AND ura.outlet_id IS NOT DISTINCT FROM CASE WHEN r.level = 'global' THEN NULL ELSE e.outlet_id END
            AND ura.outlet_department_id IS NOT DISTINCT FROM CASE WHEN r.level = 'global' THEN NULL ELSE e.department_id END
            AND ura.warehouse_id IS NULL
        )
    `);
  }

  public async down(): Promise<void> {
    // Do not remove assignments: they may have been intentionally retained or modified.
  }
}

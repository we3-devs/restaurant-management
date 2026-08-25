import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs user_role_assignments rows created by the pre-fix
 * EmployeesService.syncRoleFromPosition, which always wrote
 * scope_type='outlet' (with the employee's outlet_id) even when the
 * position's default role is level='global'. An outlet-scoped row for a
 * global role is a data bug regardless of how it was created: it silently
 * narrows PermissionsService.getAccessibleOutletIds() to that one outlet
 * instead of granting all-outlets access, contradicting the role's own
 * declared level.
 *
 * Two passes:
 *  1. Where the user already holds a correct global (outlet_id IS NULL)
 *     assignment of the same role, the outlet-scoped duplicate is just
 *     redundant — delete it rather than fight a duplicate-row conflict.
 *  2. Everything else gets corrected in place to scope_type='global' with
 *     every scope column cleared.
 */
export class FixGlobalRoleAssignmentScope1774200000000
  implements MigrationInterface
{
  name = 'FixGlobalRoleAssignmentScope1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM user_role_assignments bad
      USING roles r
      WHERE bad.role_id = r.id
        AND r.level = 'global'
        AND (bad.scope_type <> 'global' OR bad.outlet_id IS NOT NULL)
        AND EXISTS (
          SELECT 1 FROM user_role_assignments good
          WHERE good.user_id = bad.user_id
            AND good.role_id = bad.role_id
            AND good.id <> bad.id
            AND good.scope_type = 'global'
            AND good.outlet_id IS NULL
        )
    `);

    await queryRunner.query(`
      UPDATE user_role_assignments bad
      SET scope_type = 'global',
          outlet_id = NULL,
          outlet_department_id = NULL,
          warehouse_id = NULL
      FROM roles r
      WHERE bad.role_id = r.id
        AND r.level = 'global'
        AND (bad.scope_type <> 'global' OR bad.outlet_id IS NOT NULL)
    `);
  }

  // Not reversible: the original outlet_id values that caused the bug are
  // not worth restoring, and duplicates removed in the delete pass can't be
  // reconstructed.
  public async down(): Promise<void> {
    return;
  }
}

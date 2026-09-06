/**
 * Mirrors the Postgres CHECK constraint shared by roles.level,
 * permissions.level, and user_role_assignments.scope_type. The DB enforces
 * the 5-value set; this union just gives compile-time safety on top.
 */
export type ScopeLevel =
  | 'global'
  | 'outlet'
  | 'outlet_warehouse'
  | 'outlet_department'
  | 'department_warehouse';

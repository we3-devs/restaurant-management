/**
 * Which frontend app a role's holders should land in after login. Mirrors the
 * Postgres CHECK constraint on roles.portal. 'both' is for roles that
 * legitimately need the desktop dashboard's tooling but should still be
 * treated as dashboard-scoped for landing purposes — kept distinct from
 * 'dashboard' only for clarity in the admin UI.
 */
export type PortalAccess = 'dashboard' | 'staff' | 'both';

export interface RoutePermissionEntry {
  href: string
  permission: string | true
}

export interface PermissionCheckable {
  isSuperadmin: boolean
  permissions: string[]
}

/**
 * Finds the permission required for a pathname by matching against a table of
 * {href, permission} entries (exact match or href as a path prefix), picking
 * the most specific (longest) href. Returns true/undefined when nothing
 * requires gating the route.
 */
export function findRequiredPermission(
  pathname: string,
  entries: RoutePermissionEntry[],
): string | true | undefined {
  let best: RoutePermissionEntry | undefined
  for (const entry of entries) {
    const matches = pathname === entry.href || pathname.startsWith(`${entry.href}/`)
    if (matches && (!best || entry.href.length > best.href.length)) {
      best = entry
    }
  }
  return best?.permission
}

export function hasRoutePermission(user: PermissionCheckable, permission: string | true | undefined): boolean {
  return permission === undefined || permission === true || user.isSuperadmin || user.permissions.includes(permission)
}

export interface PortalCheckable {
  isSuperadmin: boolean
  /**
   * Which app the backend resolved this user into, aggregated server-side
   * (see PermissionsService#getPortalAccess) from the explicit `portal` field
   * on each of the user's active role assignments. Permissions are fully
   * admin-configurable per role, so which app a role belongs to can't be
   * inferred from its permission set — it has to be this explicit value.
   */
  portal: "dashboard" | "staff"
}

/** Where "/" should land a signed-in user. */
export function getLandingPath(user: PortalCheckable): "/dashboard" | "/staff" {
  return user.isSuperadmin || user.portal === "dashboard" ? "/dashboard" : "/staff"
}

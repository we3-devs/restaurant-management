export interface RoutePermissionEntry {
  href: string
  permission: string | true
  /** When set, only superadmins may access the route — the permission field is ignored entirely for this entry. */
  superadminOnly?: boolean
}

export interface PermissionCheckable {
  isSuperadmin: boolean
  permissions: string[]
}

/** Canonical permission predicate for all frontend visibility/action checks. */
export function hasPermission(user: PermissionCheckable, permission: string | true | null | undefined): boolean {
  return permission === undefined || permission === null || permission === true || user.isSuperadmin || user.permissions.includes(permission)
}

/**
 * Finds the route-access entry that applies to a pathname by matching against
 * a table of {href, permission, superadminOnly} entries (exact match or href
 * as a path prefix), picking the most specific (longest) href. Returns
 * undefined when nothing requires gating the route.
 */
export function findRequiredPermission(
  pathname: string,
  entries: RoutePermissionEntry[],
): RoutePermissionEntry | undefined {
  let best: RoutePermissionEntry | undefined
  for (const entry of entries) {
    const matches = pathname === entry.href || pathname.startsWith(`${entry.href}/`)
    if (matches && (!best || entry.href.length > best.href.length)) {
      best = entry
    }
  }
  return best
}

/**
 * Accepts either a raw permission requirement (`string | true | undefined`,
 * as used by ad-hoc in-component checks like `hasRoutePermission(user,
 * "food-variants.view")`) or a full `RoutePermissionEntry` (as returned by
 * `findRequiredPermission`) so route guards can express `superadminOnly`
 * without every caller having to unwrap it themselves.
 */
export function hasRoutePermission(
  user: PermissionCheckable,
  requirement: string | true | RoutePermissionEntry | undefined,
): boolean {
  if (requirement !== undefined && typeof requirement === "object") {
    return requirement.superadminOnly ? user.isSuperadmin : hasRoutePermission(user, requirement.permission)
  }
  return hasPermission(user, requirement)
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

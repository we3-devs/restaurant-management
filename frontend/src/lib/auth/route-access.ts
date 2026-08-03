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

/** Permission slugs the staff PWA (kitchen/waiter) grants — anything beyond these implies back-office/admin access. */
const STAFF_ONLY_PERMISSIONS = new Set(["orders.view", "orders.manage"])

/** Where "/" should land a signed-in user: superadmins and anyone with a permission outside the staff app's scope go to the desktop dashboard, everyone else (kitchen/waiter-only, or no role yet) goes to the staff PWA. */
export function getLandingPath(user: PermissionCheckable): "/dashboard" | "/staff" {
  const isDashboardUser = user.isSuperadmin || user.permissions.some((permission) => !STAFF_ONLY_PERMISSIONS.has(permission))
  return isDashboardUser ? "/dashboard" : "/staff"
}

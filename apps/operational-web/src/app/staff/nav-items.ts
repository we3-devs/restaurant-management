import { ChefHatIcon, ClipboardListIcon, LayoutGridIcon, PackageCheckIcon, SoupIcon, UsersIcon } from "lucide-react"

export interface StaffNavItem {
  href: string
  label: string
  description: string
  icon: typeof ChefHatIcon
  /**
   * Permission slug required to see this item. Both cooks and waiters hold
   * `orders.view`, so gating on that alone showed every tab to everyone —
   * these use whichever permission actually distinguishes the two roles
   * (per backend/src/database/seeds/run-seed.ts): cooks get
   * `kitchen-tickets.manage` but not `dining-tables.view`, waiters get the
   * reverse. Bartenders/hosts hold both, so they still see everything, which
   * matches their actual duties.
   */
  requires: "kitchen-tickets.manage" | "dining-tables.view" | "orders.manage" | "customers.view" | null
  /**
   * Role slugs that should never see this item even though they hold
   * `requires` — for cases the flat permission set can't express. Cashier
   * holds `dining-tables.view` (to see the floor and call a waiter) but
   * doesn't run food from the kitchen, so it's excluded here rather than by
   * introducing a new permission just for this one tab.
   */
  excludeRoleSlugs?: string[]
}

/** Single source of truth for what staff can reach — shared by the tab bar and the landing page so they never drift. */
export const STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    href: "/staff/kitchen",
    label: "Kitchen",
    description: "Live tickets and status updates",
    icon: ChefHatIcon,
    requires: "kitchen-tickets.manage",
  },
  {
    href: "/staff/waiter/tables",
    label: "Tables",
    description: "Floor plan and order-taking",
    icon: LayoutGridIcon,
    requires: "dining-tables.view",
  },
  {
    href: "/staff/waiter/ready",
    label: "Queue",
    description: "Ready-to-deliver items and call-waiter requests",
    icon: PackageCheckIcon,
    requires: "dining-tables.view",
    excludeRoleSlugs: ["cashier"],
  },
  {
    href: "/staff/waiter/prep",
    label: "Prep",
    description: "Items still being prepared or waiting to be served",
    icon: SoupIcon,
    requires: "orders.manage",
    excludeRoleSlugs: ["waiter"],
  },
  {
    href: "/staff/orders",
    label: "Orders",
    // /staff/waiter/pos (order-taking/cart) is still reachable by tapping a
    // table from Tables — this tab is just for finding an order to pay.
    description: "Find an order by table or customer, then pay",
    icon: ClipboardListIcon,
    requires: "orders.manage",
  },
  {
    href: "/staff/customers",
    label: "Customers",
    description: "Look up or add a customer",
    icon: UsersIcon,
    requires: "customers.view",
  },
]

/**
 * Routes the server-side guard must still gate even though they're no
 * longer their own nav tab — /staff/waiter/pos (order-taking/cart) is now
 * reached only via a table tap from Tables, not a direct tab, but it still
 * needs the same permission check a nav entry would have given it.
 */
const STAFF_EXTRA_ROUTE_PERMISSIONS: { href: string; permission: StaffNavItem["requires"] }[] = [
  { href: "/staff/waiter/pos", permission: "orders.manage" },
  // /staff/pos/receipt/[orderId] — the staff-shell counterpart to
  // (operational)/pos/receipt, linked from OrderDetail's "POS Bill"/
  // "Invoice" buttons when rendered with basePath="/staff".
  { href: "/staff/pos", permission: "orders.manage" },
]

/** Flattened {href, permission} table — shared with the server-side route guard in layout.tsx so both stay in sync with the nav. */
export const staffRoutePermissions = [
  ...STAFF_NAV_ITEMS.map((item) => ({ href: item.href, permission: item.requires ?? (true as const) })),
  ...STAFF_EXTRA_ROUTE_PERMISSIONS.map((entry) => ({ href: entry.href, permission: entry.permission ?? (true as const) })),
]

export function canSeeStaffNavItem(
  item: StaffNavItem,
  user: { isSuperadmin: boolean; permissions: string[]; roleSlugs: string[] },
): boolean {
  const hasPermission = !item.requires || user.isSuperadmin || user.permissions.includes(item.requires)
  const isExcluded =
    !user.isSuperadmin && item.excludeRoleSlugs?.some((slug) => user.roleSlugs.includes(slug))
  return hasPermission && !isExcluded
}

/** Mirrors canSeeStaffNavItem's role exclusion for the server-side route guard in layout.tsx, which only has a pathname (not a resolved nav item) to work from. */
export function isStaffRouteBlockedForRole(
  pathname: string,
  user: { isSuperadmin: boolean; roleSlugs: string[] },
): boolean {
  if (user.isSuperadmin) return false
  return STAFF_NAV_ITEMS.some(
    (item) =>
      item.excludeRoleSlugs?.some((slug) => user.roleSlugs.includes(slug)) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )
}/
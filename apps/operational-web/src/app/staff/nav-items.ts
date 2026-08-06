import { ChefHatIcon, ClipboardListIcon, LayoutGridIcon, PackageCheckIcon, UserIcon, UsersIcon } from "lucide-react"

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
    label: "Ready to deliver",
    description: "Items the kitchen has finished",
    icon: PackageCheckIcon,
    requires: "dining-tables.view",
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
  {
    href: "/staff/profile",
    label: "Profile",
    description: "Account and notification settings",
    icon: UserIcon,
    requires: null,
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
  user: { isSuperadmin: boolean; permissions: string[] },
): boolean {
  return !item.requires || user.isSuperadmin || user.permissions.includes(item.requires)
}

import { ChefHatIcon, LayoutGridIcon, PackageCheckIcon, ReceiptIcon, UserIcon } from "lucide-react"

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
  requires: "kitchen-tickets.manage" | "dining-tables.view" | "orders.manage" | null
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
    href: "/staff/waiter/pos",
    label: "Billing",
    description: "Open orders and take payment",
    icon: ReceiptIcon,
    requires: "orders.manage",
  },
  {
    href: "/staff/profile",
    label: "Profile",
    description: "Account and notification settings",
    icon: UserIcon,
    requires: null,
  },
]

/** Flattened {href, permission} table — shared with the server-side route guard in layout.tsx so both stay in sync with the nav. */
export const staffRoutePermissions = STAFF_NAV_ITEMS.map((item) => ({
  href: item.href,
  permission: item.requires ?? (true as const),
}))

export function canSeeStaffNavItem(
  item: StaffNavItem,
  user: { isSuperadmin: boolean; permissions: string[] },
): boolean {
  return !item.requires || user.isSuperadmin || user.permissions.includes(item.requires)
}

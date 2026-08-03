import { ChefHatIcon, LayoutGridIcon, PackageCheckIcon, UserIcon } from "lucide-react"

export interface StaffNavItem {
  href: string
  label: string
  description: string
  icon: typeof ChefHatIcon
  /** Permission slug required to see this item — same slugs the desktop kitchen/service pages already gate on. */
  requires: "orders.view" | "orders.manage" | null
}

/** Single source of truth for what staff can reach — shared by the tab bar and the landing page so they never drift. */
export const STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    href: "/staff/kitchen",
    label: "Kitchen",
    description: "Live tickets and status updates",
    icon: ChefHatIcon,
    requires: "orders.view",
  },
  {
    href: "/staff/waiter/tables",
    label: "Tables",
    description: "Floor plan and order-taking",
    icon: LayoutGridIcon,
    requires: "orders.view",
  },
  {
    href: "/staff/waiter/ready",
    label: "Ready to deliver",
    description: "Items the kitchen has finished",
    icon: PackageCheckIcon,
    requires: "orders.view",
  },
  {
    href: "/staff/profile",
    label: "Profile",
    description: "Account and notification settings",
    icon: UserIcon,
    requires: null,
  },
]

/** Routes reachable only via deep link (not a tab), so they're not in STAFF_NAV_ITEMS, but still need gating — same slug as the desktop /pos page. */
const STAFF_DEEP_LINK_ROUTES = [{ href: "/staff/waiter/pos", permission: "orders.manage" as const }]

/** Flattened {href, permission} table — shared with the server-side route guard in layout.tsx so both stay in sync with the nav. */
export const staffRoutePermissions = [
  ...STAFF_NAV_ITEMS.map((item) => ({
    href: item.href,
    permission: item.requires ?? (true as const),
  })),
  ...STAFF_DEEP_LINK_ROUTES,
]

export function canSeeStaffNavItem(
  item: StaffNavItem,
  user: { isSuperadmin: boolean; permissions: string[] },
): boolean {
  return !item.requires || user.isSuperadmin || user.permissions.includes(item.requires)
}

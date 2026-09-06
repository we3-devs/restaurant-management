import { Bell, type LucideIcon, UtensilsCrossed } from "lucide-react"
import { hasRoutePermission } from "@rms/auth/route-access"

export interface NavLinkDef {
  href: string
  label: string
  permission: string | true
}

export interface NavGroupDef {
  label: string
  icon: LucideIcon
  links: NavLinkDef[]
}

export const navGroupDefs: NavGroupDef[] = [
  {
    label: "Overview",
    icon: Bell,
    links: [{ href: "/operational/notifications", label: "Notifications", permission: true }],
  },
  {
    label: "Operations",
    icon: UtensilsCrossed,
    links: [
      { href: "/operational/pos", label: "POS", permission: "orders.manage" },
      { href: "/operational/kitchen", label: "Kitchen", permission: "orders.view" },
      { href: "/operational/service", label: "Service", permission: "orders.view" },
      { href: "/operational/floor", label: "Floor", permission: "table-sessions.view" },
      { href: "/operational/orders", label: "Orders", permission: "orders.view" },
      { href: "/operational/table-sessions", label: "Table Sessions", permission: "table-sessions.view" },
      { href: "/operational/reservations", label: "Reservations", permission: "reservations.view" },
    ],
  },
]

/** Flattened {href, permission} table — shared with the server-side route guard in layout.tsx so both stay in sync with the nav. */
export const navRoutePermissions = navGroupDefs.flatMap((group) => group.links)

export function visibleNavGroups(permissions: string[], isSuperadmin: boolean) {
  const has = (permission: string | true) => hasRoutePermission({ isSuperadmin, permissions }, permission)

  return navGroupDefs
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => has(link.permission)),
    }))
    .filter((group) => group.links.length > 0)
}

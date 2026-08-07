import {
  Boxes,
  Building2,
  Contact,
  Gauge,
  type LucideIcon,
  Salad,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react"

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
    icon: Gauge,
    links: [
      { href: "/dashboard", label: "Dashboard", permission: true },
      { href: "/tables", label: "Tables", permission: "dining-tables.view" },
      { href: "/orders", label: "Orders", permission: "orders.view" },
      { href: "/reports", label: "Reports", permission: "reports.view" },
      { href: "/notifications", label: "Notifications", permission: true },
    ],
  },
  {
    label: "Menu",
    icon: Salad,
    links: [
      { href: "/food-categories", label: "Food Categories", permission: "food-categories.view" },
      { href: "/foods", label: "Foods", permission: "foods.view" },
      { href: "/food-variants", label: "Food Variants", permission: "food-variants.view" },
      { href: "/addon-groups", label: "Addon Groups", permission: "addon-groups.view" },
      { href: "/addons", label: "Addons", permission: "addons.view" },
    ],
  },
  {
    label: "Inventory",
    icon: Boxes,
    links: [
      { href: "/units", label: "Units", permission: "units.view" },
      { href: "/ingredient-categories", label: "Ingredient Categories", permission: "ingredient-categories.view" },
      { href: "/ingredients", label: "Ingredients", permission: "ingredients.view" },
      { href: "/stock-ins", label: "Stock-Ins", permission: "stock-ins.view" },
      { href: "/stock-outs", label: "Stock-Outs", permission: "stock-outs.view" },
      { href: "/stock-transfers", label: "Stock Transfers", permission: "stock-transfers.view" },
      { href: "/ingredient-wastages", label: "Wastages", permission: "ingredient-wastages.view" },
      { href: "/stock-adjustments", label: "Stock Adjustments", permission: "stock-adjustments.view" },
      { href: "/stock-counts", label: "Stock Counts", permission: "stock-counts.view" },
    ],
  },
  {
    label: "Purchasing",
    icon: Truck,
    links: [
      { href: "/suppliers", label: "Suppliers", permission: "suppliers.view" },
      { href: "/purchase-orders", label: "Purchase Orders", permission: "purchase-orders.view" },
      { href: "/goods-receiving", label: "Goods Receiving", permission: "goods-receiving.view" },
      { href: "/purchase-returns", label: "Purchase Returns", permission: "purchase-returns.view" },
      { href: "/supplier-payments", label: "Supplier Payments", permission: "supplier-payments.view" },
    ],
  },
  {
    label: "Staff",
    icon: Contact,
    links: [
      { href: "/employees", label: "Employees", permission: "employees.view" },
      { href: "/positions", label: "Positions", permission: "employees.view" },
      { href: "/shifts", label: "Shifts", permission: "shifts.view" },
      { href: "/attendance", label: "Attendance", permission: "attendance.view" },
      { href: "/staff-dashboard", label: "Staff Dashboard", permission: "employees.view" },
    ],
  },
  {
    label: "Loyalty",
    icon: Sparkles,
    links: [{ href: "/loyalty", label: "Loyalty", permission: "loyalty.view" }],
  },
  {
    label: "Organization",
    icon: Building2,
    links: [
      { href: "/users", label: "Users", permission: "users.view" },
      { href: "/roles", label: "Roles", permission: "roles.view" },
      { href: "/outlets", label: "Outlets", permission: "outlets.view" },
      { href: "/outlet-departments", label: "Departments", permission: "outlet-departments.view" },
      { href: "/warehouses", label: "Warehouses", permission: "warehouses.view" },
      { href: "/customers", label: "Customers", permission: "customers.view" },
    ],
  },
  {
    label: "System",
    icon: ShieldCheck,
    links: [
      { href: "/settings", label: "Settings", permission: "settings.view" },
      { href: "/audit-logs", label: "Audit Logs", permission: "audit-logs.view" },
    ],
  },
]

/** Flattened {href, permission} table — shared with the server-side route guard in layout.tsx so both stay in sync with the nav. */
export const navRoutePermissions = navGroupDefs.flatMap((group) => group.links)

/** Sidebar-only restriction (permissions/API access are untouched) — the "admin" role only ever sees these groups, regardless of what its permissions would otherwise reveal. Operations moved to operational-web entirely, so only Overview remains here. */
const ADMIN_ROLE_VISIBLE_GROUPS = new Set(['Overview'])

export function visibleNavGroups(permissions: string[], isSuperadmin: boolean, roleSlugs: string[] = []) {
  const has = (permission: string | true) => permission === true || isSuperadmin || permissions.includes(permission)
  const restrictToAdminGroups = !isSuperadmin && roleSlugs.includes('admin')

  return navGroupDefs
    .filter((group) => !restrictToAdminGroups || ADMIN_ROLE_VISIBLE_GROUPS.has(group.label))
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => has(link.permission)),
    }))
    .filter((group) => group.links.length > 0)
}

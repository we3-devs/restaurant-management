import {
  Boxes,
  Building2,
  Contact,
  // FileText,
  Gauge,
  type LucideIcon,
  Salad,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react"
import { hasRoutePermission } from "@rms/auth/route-access"

export interface NavLinkDef {
  href: string
  label: string
  permission: string | true
  /** When set, only superadmins may see/access this link — permission is ignored entirely. */
  superadminOnly?: boolean
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
      { href: "/dashboard/summary", label: "Period Summary", permission: "dashboard.view" },
      { href: "/dashboard/analytics", label: "Analytics", permission: "dashboard.view" },
      { href: "/dashboard/assistant", label: "Operations Assistant", permission: "dashboard.view" },
      { href: "/dashboard/dining-areas", label: "Dining Areas", permission: "dining-areas.view" },
      { href: "/dashboard/tables", label: "Tables", permission: "dining-tables.view" },
      { href: "/dashboard/orders", label: "Orders", permission: "orders.view" },
      { href: "/dashboard/invoices", label: "Invoices", permission: "orders.view" },
      { href: "/dashboard/reports", label: "Reports", permission: "reports.view" },
      { href: "/dashboard/notifications", label: "Notifications", permission: true },
    ],
  },
  {
    label: "Menu",
    icon: Salad,
    links: [
      { href: "/dashboard/food-categories", label: "Food Categories", permission: "food-categories.view" },
      { href: "/dashboard/foods", label: "Foods", permission: "foods.view" },
      { href: "/dashboard/variants", label: "Variants", permission: "food-variants.view" },
      { href: "/dashboard/sub-variants", label: "Sub-variants", permission: "food-variants.view" },
      // The route keeps its old path so existing links and bookmarks still work;
      // only the label reflects that these rows are food items now.
      { href: "/dashboard/food-variants", label: "Food Items", permission: "food-variants.view" },
      { href: "/dashboard/addon-groups", label: "Addon Groups", permission: "addon-groups.view" },
      { href: "/dashboard/addons", label: "Addons", permission: "addons.view" },
    ],
  },
  {
    label: "Inventory",
    icon: Boxes,
    links: [
      { href: "/dashboard/units", label: "Units", permission: "units.view" },
      { href: "/dashboard/ingredient-categories", label: "Ingredient Categories", permission: "ingredient-categories.view" },
      { href: "/dashboard/ingredients", label: "Ingredients", permission: "ingredients.view" },
      { href: "/dashboard/stock-ins", label: "Stock-Ins", permission: "stock-ins.view" },
      { href: "/dashboard/stock-outs", label: "Stock-Outs", permission: "stock-outs.view" },
      { href: "/dashboard/stock-transfers", label: "Stock Transfers", permission: "stock-transfers.view" },
      { href: "/dashboard/ingredient-wastages", label: "Wastages", permission: "ingredient-wastages.view" },
      { href: "/dashboard/stock-adjustments", label: "Stock Adjustments", permission: "stock-adjustments.view" },
      { href: "/dashboard/stock-counts", label: "Stock Counts", permission: "stock-counts.view" },
    ],
  },
  {
    label: "Purchasing",
    icon: Truck,
    links: [
      { href: "/dashboard/suppliers", label: "Suppliers", permission: "suppliers.view" },
      { href: "/dashboard/purchase-orders", label: "Purchase Orders", permission: "purchase-orders.view" },
      { href: "/dashboard/goods-receiving", label: "Goods Receiving", permission: "goods-receiving.view" },
      { href: "/dashboard/purchase-returns", label: "Purchase Returns", permission: "purchase-returns.view" },
      { href: "/dashboard/supplier-payments", label: "Supplier Payments", permission: "supplier-payments.view" },
    ],
  },
  {
    label: "Staff",
    icon: Contact,
    links: [
      { href: "/dashboard/employees", label: "Employees", permission: "employees.view" },
      { href: "/dashboard/positions", label: "Positions", permission: "employees.view" },
      { href: "/dashboard/shifts", label: "Shifts", permission: "shifts.view" },
      { href: "/dashboard/attendance", label: "Attendance", permission: "attendance.view" },
      { href: "/dashboard/staff-dashboard", label: "Staff Dashboard", permission: "employees.view" },
    ],
  },
  {
    label: "Loyalty",
    icon: Sparkles,
    links: [{ href: "/dashboard/loyalty", label: "Loyalty", permission: "loyalty.view" }],
  },
  {
    label: "Organization",
    icon: Building2,
    links: [
      { href: "/dashboard/users", label: "Users", permission: "users.view" },
      { href: "/dashboard/roles", label: "Roles", permission: "roles.view" },
      { href: "/dashboard/outlets", label: "Outlets", permission: "outlets.view" },
      { href: "/dashboard/outlet-departments", label: "Departments", permission: "outlet-departments.view" },
      { href: "/dashboard/warehouses", label: "Warehouses", permission: "warehouses.view" },
      { href: "/dashboard/customers", label: "Customers", permission: "customers.view" },
    ],
  },
  {
    label: "System",
    icon: ShieldCheck,
    links: [
      { href: "/dashboard/settings", label: "Settings", permission: "settings.view" },
      { href: "/audit-logs", label: "Audit Logs", permission: "audit-logs.view" },
    ],
  },
  {
    label: "Superadmin",
    icon: ShieldAlert,
    links: [
      { href: "/superadmin", label: "Tenant Management", permission: true, superadminOnly: true },
      { href: "/dashboard/data-import", label: "Data Import", permission: true, superadminOnly: true },
    ],
  },
]

/** Flattened {href, permission} table — shared with the server-side route guard in layout.tsx so both stay in sync with the nav. */
export const navRoutePermissions = navGroupDefs.flatMap((group) => group.links)

/** Sidebar-only restriction (permissions/API access are untouched) — the "admin" role only ever sees these groups, regardless of what its permissions would otherwise reveal. Operations moved to operational-web entirely, so only Overview remains here. */
const ADMIN_ROLE_VISIBLE_GROUPS = new Set(['Overview'])

export function visibleNavGroups(permissions: string[], isSuperadmin: boolean, roleSlugs: string[] = []) {
  const has = (permission: string | true) => hasRoutePermission({ isSuperadmin, permissions }, permission)
  const restrictToAdminGroups = !isSuperadmin && roleSlugs.includes('admin')

  return navGroupDefs
    .filter((group) => !restrictToAdminGroups || ADMIN_ROLE_VISIBLE_GROUPS.has(group.label))
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => (link.superadminOnly ? isSuperadmin : has(link.permission))),
    }))
    .filter((group) => group.links.length > 0)
}

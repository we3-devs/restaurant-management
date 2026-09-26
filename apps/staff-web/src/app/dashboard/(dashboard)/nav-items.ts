import {
  Boxes,
  Building2,
  Contact,
  FolderOpen,
  LayoutGrid,
  Gauge,
  type LucideIcon,
  Salad,
  ShieldCheck,
  Truck,
} from "lucide-react"
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
    icon: Gauge,
    links: [
      { href: "/dashboard", label: "Dashboard", permission: true },
      { href: "/dashboard/overview/summary", label: "Period Summary", permission: "dashboard.view" },
      { href: "/dashboard/overview/analytics", label: "Analytics", permission: "dashboard.view" },
      { href: "/dashboard/overview/foods", label: "Foods", permission: "foods.view" },
      { href: "/dashboard/overview/inventory-items", label: "Inventory Items", permission: "ingredients.view" },
      { href: "/dashboard/overview/view-dining", label: "View Dining Areas", permission: "dining-tables.view" },
      { href: "/dashboard/overview/view-table", label: "View Tables", permission: "dining-tables.view" },
      { href: "/dashboard/overview/orders", label: "Orders", permission: "orders.view" },
      { href: "/dashboard/overview/sales", label: "Sales", permission: "reports.view" },
      { href: "/dashboard/overview/invoices", label: "Invoices", permission: "orders.view" },
      { href: "/dashboard/overview/reports", label: "Reports", permission: "reports.view" },
      { href: "/dashboard/overview/assets", label: "View assets", permission: "dashboard.view" },
    ],
  },
  {
    label: "Floor Management",
    icon: LayoutGrid,
    links: [
      { href: "/dashboard/floor-management/floor", label: "Floor Plan", permission: "dining-tables.view" },
      { href: "/dashboard/floor-management/dining-areas", label: "Dining Areas", permission: "dining-tables.view" },
      { href: "/dashboard/floor-management/tables", label: "Tables", permission: "dining-tables.view" },
    ],
  },
  {
    label: "Menu",
    icon: Salad,
    links: [
      { href: "/dashboard/menu/food-categories", label: "Food Categories", permission: "food-categories.view" },
      { href: "/dashboard/menu/foods", label: "Manage Foods", permission: "foods.view" },
      { href: "/dashboard/menu/variants", label: "Variants", permission: "food-variants.view" },
      { href: "/dashboard/menu/sub-variants", label: "Sub-variants", permission: "food-variants.view" },
      // The route keeps its old path so existing links and bookmarks still work;
      // only the label reflects that these rows are food items now.
      { href: "/dashboard/menu/food-variants", label: "Food Items", permission: "food-variants.view" },
    ],
  },
  {
    label: "Inventory",
    icon: Boxes,
    links: [
      { href: "/dashboard/inventory/units", label: "Units", permission: "units.view" },
      { href: "/dashboard/inventory/ingredient-categories", label: "Ingredient Categories", permission: "ingredient-categories.view" },
      { href: "/dashboard/inventory/ingredients", label: "Ingredients", permission: "ingredients.view" },
      { href: "/dashboard/inventory/inventory-items", label: "Manage Inventory Items", permission: "ingredients.view" },
      { href: "/dashboard/inventory/stock-ins", label: "Stock-Ins", permission: "stock-ins.view" },
      { href: "/dashboard/inventory/stock-outs", label: "Stock-Outs", permission: "stock-outs.view" },
      { href: "/dashboard/inventory/stock-transfers", label: "Stock Transfers", permission: "stock-transfers.view" },
      { href: "/dashboard/inventory/ingredient-wastages", label: "Wastages", permission: "ingredient-wastages.view" },
      { href: "/dashboard/inventory/stock-adjustments", label: "Stock Adjustments", permission: "stock-adjustments.view" },
      { href: "/dashboard/inventory/stock-counts", label: "Stock Counts", permission: "stock-counts.view" },
    ],
  },
  {
    label: "Purchasing",
    icon: Truck,
    links: [
      { href: "/dashboard/purchasing/suppliers", label: "Suppliers", permission: "suppliers.view" },
      { href: "/dashboard/purchasing/supplier-categories", label: "Supplier Categories", permission: "suppliers.view" },
      { href: "/dashboard/purchasing/purchase-orders", label: "Purchase Orders", permission: "purchase-orders.view" },
      { href: "/dashboard/purchasing/goods-receiving", label: "Goods Receiving", permission: "goods-receiving.view" },
      { href: "/dashboard/purchasing/purchase-returns", label: "Purchase Returns", permission: "purchase-returns.view" },
      { href: "/dashboard/purchasing/supplier-payments", label: "Supplier Payments", permission: "supplier-payments.view" },
    ],
  },
  {
    label: "Staff",
    icon: Contact,
    links: [
      { href: "/dashboard/staff/shifts", label: "Shifts", permission: "shifts.view" },
      { href: "/dashboard/staff/attendance", label: "Attendance", permission: "attendance.view" },
      { href: "/dashboard/staff/staff-dashboard", label: "Staff Dashboard", permission: "employees.view" },
    ],
  },
  {
    label: "Organization",
    icon: Building2,
    links: [
      { href: "/dashboard/organization/outlets", label: "Outlets", permission: "outlets.view" },
      { href: "/dashboard/organization/warehouses", label: "Warehouses", permission: "warehouses.view" },
      { href: "/dashboard/organization/customers", label: "Customers", permission: "customers.view" },
      { href: "/dashboard/organization/credit", label: "Customer Credit", permission: "customer-credit.view" },
      { href: "/dashboard/overview/assets/add", label: "Add assets", permission: "dashboard.view" },
    ],
  },
  {
    label: "Control Panel",
    icon: ShieldCheck,
    links: [
      { href: "/dashboard/control-panel", label: "Control Panel", permission: true },
      { href: "/dashboard/control-panel/permissions", label: "Roles & Permissions", permission: "employees.view" },
      { href: "/dashboard/control-panel/employees", label: "Staff & Assignments", permission: "employees.view" },
      { href: "/dashboard/control-panel/departments", label: "Departments", permission: "outlet-departments.view" },
      { href: "/dashboard/control-panel/users", label: "Users", permission: "users.view" },
      { href: "/dashboard/control-panel/notifications", label: "Notifications", permission: "settings.view" },
      { href: "/dashboard/settings", label: "Settings", permission: "settings.view" },
    ],
  },
  {
    label: "Account",
    icon: FolderOpen,
    links: [
      { href: "/dashboard/account/profile", label: "Profile", permission: true },
      { href: "/dashboard/account/data-import", label: "Data Import", permission: true },
    ],
  },
]

/** Flattened {href, permission} table — shared with the server-side route guard in layout.tsx. */
export const navRoutePermissions = navGroupDefs.flatMap((group) => group.links)

export function visibleNavGroups(permissions: string[]) {
  const has = (permission: string | true) => hasRoutePermission({ permissions }, permission)

  return navGroupDefs
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => has(link.permission)),
    }))
    .filter((group) => group.links.length > 0)
}

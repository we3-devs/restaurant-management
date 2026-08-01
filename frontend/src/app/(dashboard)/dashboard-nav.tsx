"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Boxes,
  Building2,
  ChevronDown,
  Contact,
  Gauge,
  type LucideIcon,
  Salad,
  ShieldCheck,
  Sparkles,
  Truck,
  UtensilsCrossed,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface DashboardNavProps {
  permissions: string[]
  isSuperadmin: boolean
}

interface NavLink {
  href: string
  label: string
  show: boolean
}

interface NavGroup {
  label: string
  icon: LucideIcon
  links: NavLink[]
}

export function DashboardNav({ permissions, isSuperadmin }: DashboardNavProps) {
  const pathname = usePathname()
  const has = (slug: string) => isSuperadmin || permissions.includes(slug)

  const groups: NavGroup[] = [
    {
      label: "Overview",
      icon: Gauge,
      links: [
        { href: "/dashboard", label: "Dashboard", show: true },
        { href: "/reports", label: "Reports", show: has("reports.view") },
        { href: "/notifications", label: "Notifications", show: true },
      ],
    },
    {
      label: "Operations",
      icon: UtensilsCrossed,
      links: [
        { href: "/pos", label: "POS", show: has("orders.manage") },
        { href: "/kitchen", label: "Kitchen", show: has("orders.view") },
        { href: "/service", label: "Service", show: has("orders.view") },
        { href: "/floor", label: "Floor", show: has("table-sessions.view") },
        { href: "/orders", label: "Orders", show: has("orders.view") },
        { href: "/table-sessions", label: "Table Sessions", show: has("table-sessions.view") },
        { href: "/dining-areas", label: "Dining Areas", show: has("dining-areas.view") },
        { href: "/dining-tables", label: "Dining Tables", show: has("dining-tables.view") },
        { href: "/reservations", label: "Reservations", show: has("reservations.view") },
        { href: "/customers", label: "Customers", show: has("customers.view") },
      ],
    },
    {
      label: "Menu",
      icon: Salad,
      links: [
        { href: "/food-categories", label: "Food Categories", show: has("food-categories.view") },
        { href: "/foods", label: "Foods", show: has("foods.view") },
        { href: "/food-variants", label: "Food Variants", show: has("food-variants.view") },
        { href: "/addon-groups", label: "Addon Groups", show: has("addon-groups.view") },
        { href: "/addons", label: "Addons", show: has("addons.view") },
      ],
    },
    {
      label: "Inventory",
      icon: Boxes,
      links: [
        { href: "/units", label: "Units", show: has("units.view") },
        { href: "/ingredient-categories", label: "Ingredient Categories", show: has("ingredient-categories.view") },
        { href: "/ingredients", label: "Ingredients", show: has("ingredients.view") },
        { href: "/stock-ins", label: "Stock-Ins", show: has("stock-ins.view") },
        { href: "/stock-outs", label: "Stock-Outs", show: has("stock-outs.view") },
        { href: "/stock-transfers", label: "Stock Transfers", show: has("stock-transfers.view") },
        { href: "/ingredient-wastages", label: "Wastages", show: has("ingredient-wastages.view") },
        { href: "/stock-adjustments", label: "Stock Adjustments", show: has("stock-adjustments.view") },
        { href: "/stock-counts", label: "Stock Counts", show: has("stock-counts.view") },
      ],
    },
    {
      label: "Purchasing",
      icon: Truck,
      links: [
        { href: "/suppliers", label: "Suppliers", show: has("suppliers.view") },
        { href: "/purchase-orders", label: "Purchase Orders", show: has("purchase-orders.view") },
        { href: "/goods-receiving", label: "Goods Receiving", show: has("goods-receiving.view") },
        { href: "/purchase-returns", label: "Purchase Returns", show: has("purchase-returns.view") },
        { href: "/supplier-payments", label: "Supplier Payments", show: has("supplier-payments.view") },
      ],
    },
    {
      label: "Staff",
      icon: Contact,
      links: [
        { href: "/employees", label: "Employees", show: has("employees.view") },
        { href: "/positions", label: "Positions", show: has("employees.view") },
        { href: "/shifts", label: "Shifts", show: has("shifts.view") },
        { href: "/attendance", label: "Attendance", show: has("attendance.view") },
        { href: "/staff-dashboard", label: "Staff Dashboard", show: has("employees.view") },
      ],
    },
    {
      label: "Loyalty",
      icon: Sparkles,
      links: [{ href: "/loyalty", label: "Loyalty", show: has("loyalty.view") }],
    },
    {
      label: "Organization",
      icon: Building2,
      links: [
        { href: "/users", label: "Users", show: has("users.view") },
        { href: "/roles", label: "Roles", show: has("roles.view") },
        { href: "/outlets", label: "Outlets", show: has("outlets.view") },
        { href: "/outlet-departments", label: "Departments", show: has("outlet-departments.view") },
        { href: "/warehouses", label: "Warehouses", show: has("warehouses.view") },
      ],
    },
    {
      label: "System",
      icon: ShieldCheck,
      links: [
        { href: "/settings", label: "Settings", show: has("settings.view") },
        { href: "/audit-logs", label: "Audit Logs", show: has("audit-logs.view") },
      ],
    },
  ]
    .map((group) => ({ ...group, links: group.links.filter((link) => link.show) }))
    .filter((group) => group.links.length > 0)

  const activeGroupLabel = groups.find((group) =>
    group.links.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)),
  )?.label

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <NavSection key={group.label} group={group} pathname={pathname} defaultOpen={group.label === activeGroupLabel} />
      ))}
    </nav>
  )
}

function NavSection({
  group,
  pathname,
  defaultOpen,
}: {
  group: NavGroup
  pathname: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || group.links.length <= 3)
  const Icon = group.icon

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground"
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 border-l border-border/60 pl-3.5">
          {group.links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

import Link from "next/link"

interface DashboardNavProps {
  permissions: string[]
  isSuperadmin: boolean
}

export function DashboardNav({ permissions, isSuperadmin }: DashboardNavProps) {
  const has = (slug: string) => isSuperadmin || permissions.includes(slug)

  const links = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/users", label: "Users", show: has("users.view") },
    { href: "/roles", label: "Roles", show: has("roles.view") },
    { href: "/outlets", label: "Outlets", show: has("outlets.view") },
    {
      href: "/outlet-departments",
      label: "Departments",
      show: has("outlet-departments.view"),
    },
    { href: "/warehouses", label: "Warehouses", show: has("warehouses.view") },
    {
      href: "/food-categories",
      label: "Food Categories",
      show: has("food-categories.view"),
    },
    { href: "/foods", label: "Foods", show: has("foods.view") },
    {
      href: "/food-variants",
      label: "Food Variants",
      show: has("food-variants.view"),
    },
    {
      href: "/addon-groups",
      label: "Addon Groups",
      show: has("addon-groups.view"),
    },
    { href: "/addons", label: "Addons", show: has("addons.view") },
    {
      href: "/dining-areas",
      label: "Dining Areas",
      show: has("dining-areas.view"),
    },
    {
      href: "/dining-tables",
      label: "Dining Tables",
      show: has("dining-tables.view"),
    },
    {
      href: "/table-sessions",
      label: "Table Sessions",
      show: has("table-sessions.view"),
    },
    { href: "/orders", label: "Orders", show: has("orders.view") },
  ].filter((link) => link.show)

  return (
    <nav className="flex items-center gap-4 text-sm">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

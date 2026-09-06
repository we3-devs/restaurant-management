"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useCurrentUser } from "@rms/auth/current-user-context"
import { cn } from "@rms/ui/cn"
import { STAFF_NAV_ITEMS, canSeeStaffNavItem } from "./nav-items"

export function StaffTabBar() {
  const pathname = usePathname()
  const user = useCurrentUser()
  const visibleTabs = STAFF_NAV_ITEMS.filter((item) => canSeeStaffNavItem(item, user))

  return (
    <nav
      className="sticky bottom-0 z-20 flex shrink-0 items-stretch border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/75"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {visibleTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-5" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

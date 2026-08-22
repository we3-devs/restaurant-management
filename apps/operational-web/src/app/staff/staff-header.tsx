"use client"

import { ThemeToggle } from "@rms/ui/theme-toggle"
import { NotificationBell } from "@rms/ui/notification-bell"
import { OfflineIndicator } from "@rms/ui/offline-indicator"
import { UserMenu } from "@rms/ui/user-menu"
import { Skeleton } from "@rms/ui/skeleton"
import { HeaderPortalLink } from "@rms/ui/header-portal-switcher"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"

/** Compact header for the staff mobile shell — no sidebar, no command palette. The full portal Select doesn't fit, so dual-portal users get an icon-only jump link instead. */
export function StaffHeader() {
  const { outlets, outletId, isLoadingOutlets } = useActiveOutlet()
  const outletName = outlets.find((o) => o.id === outletId)?.name

  return (
    <header
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/75"
      style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}
    >
      <div className="min-w-0 flex-1">
        {isLoadingOutlets ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <p className="truncate text-sm font-semibold leading-tight">{outletName ?? "Staff"}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <OfflineIndicator />
        <HeaderPortalLink current="staff" />
        <NotificationBell />
        <ThemeToggle />
        <UserMenu profileHref="/staff/profile" />
      </div>
    </header>
  )
}

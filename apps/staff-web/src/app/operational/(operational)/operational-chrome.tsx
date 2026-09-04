"use client"

import { AccessDenied } from "@rms/ui/access-denied"
import { AppSidebarShell } from "@rms/ui/app-sidebar-shell"
import { MobileNavToggle } from "@rms/ui/mobile-nav-toggle"
import { HeaderDepartmentSwitcher } from "@rms/ui/header-department-switcher"
import { HeaderOutletSwitcher } from "@rms/ui/header-outlet-switcher"
import { HeaderPortalSwitcher } from "@rms/ui/header-portal-switcher"
import { HeaderSearchButton } from "@rms/ui/header-search-button"
import { NotificationBell } from "@rms/ui/notification-bell"
import { UserMenu } from "@rms/ui/user-menu"
import { CommandPalette } from "@rms/ui/command-palette"
import { OfflineIndicator } from "@rms/ui/offline-indicator"
import { ThemeToggle } from "@rms/ui/theme-toggle"
import { Separator } from "@rms/ui/separator"
import { visibleNavGroups } from "./nav-items"
import { OperatingStatusBadge } from "@rms/ui/operating-status-badge"
import { RegisterOperationalServiceWorker } from "../../register-operational-sw"

/**
 * Client component so visibleNavGroups() (whose result embeds Lucide icon
 * components) runs on the client instead of being computed in the server
 * layout and passed down as a prop — Server->Client props must be plain
 * serializable data, and icon components aren't. permissions/isSuperadmin
 * are plain data, so those are what actually cross the boundary.
 */
export function OperationalChrome({
  permissions,
  isSuperadmin,
  allowed,
  children,
}: {
  permissions: string[]
  isSuperadmin: boolean
  allowed: boolean
  children: React.ReactNode
}) {
  const groups = visibleNavGroups(permissions, isSuperadmin)

  return (
    <>
      <RegisterOperationalServiceWorker />
      <CommandPalette groups={groups} />
      <div className="flex min-h-screen">
        <AppSidebarShell groups={groups}>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-6">
              <MobileNavToggle />
              <HeaderSearchButton />
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <OfflineIndicator />
                <HeaderOutletSwitcher />
                <OperatingStatusBadge />
                <HeaderDepartmentSwitcher />
                <HeaderPortalSwitcher current="staff" />
                <Separator orientation="vertical" className="mx-1 h-6" />
                <ThemeToggle />
                <NotificationBell realtimeToast={false} pushApp="operational" />
                <Separator orientation="vertical" className="mx-1 h-6" />
                <UserMenu />
              </div>
            </header>
            <main className="flex flex-1 flex-col p-4 sm:p-6">{allowed ? children : <AccessDenied />}</main>
          </div>
        </AppSidebarShell>
      </div>
    </>
  )
}

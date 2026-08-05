import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@rms/auth/dal"
import { CurrentUserProvider } from "@rms/auth/current-user-context"
import { findRequiredPermission, getLandingPath, hasRoutePermission } from "@rms/auth/route-access"
import { ActiveOutletProvider } from "@rms/api-client/outlet/active-outlet-context"
import { AccessDenied } from "@rms/ui/access-denied"
import { AppSidebarShell } from "@rms/ui/app-sidebar-shell"
import { MobileNavToggle } from "@rms/ui/mobile-nav-toggle"
import { HeaderDepartmentSwitcher } from "@rms/ui/header-department-switcher"
import { HeaderOutletSwitcher } from "@rms/ui/header-outlet-switcher"
import { HeaderSearchButton } from "@rms/ui/header-search-button"
import { NotificationBell } from "@rms/ui/notification-bell"
import { navRoutePermissions, visibleNavGroups } from "./nav-items"
import { UserMenu } from "@rms/ui/user-menu"
import { RealtimeInvalidationProvider } from "@rms/api-client/realtime-invalidation-provider"
import { CommandPalette } from "@rms/ui/command-palette"
import { OfflineIndicator } from "@rms/ui/offline-indicator"
import { ThemeToggle } from "@rms/ui/theme-toggle"
import { Separator } from "@/components/ui/separator"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The real auth check — proxy.ts only did an optimistic cookie check. This
  // is the only /auth/me call in the tree; everything below reads the result
  // from CurrentUserProvider instead of fetching it again.
  const user = await getCurrentUser()

  const pathname = (await headers()).get("x-pathname") ?? ""

  // "/" redirects straight to /dashboard without knowing the user's portal
  // (to avoid a second /auth/me call before this one). Only re-route from
  // here when they actually landed on "/dashboard" itself and belong in the
  // staff PWA instead — deep links into other (dashboard)-group routes (e.g.
  // an admin's /orders bookmark) are unaffected, same as before this change.
  // operational-web is a separate deployment now, so this is a cross-origin
  // redirect rather than a local one — see AUTH_COOKIE_DOMAIN in
  // packages/auth/src/session.ts for how the session survives the hop.
  if (pathname === "/dashboard" && getLandingPath(user) === "/staff") {
    redirect(`${process.env.OPERATIONAL_WEB_URL ?? "http://localhost:3100"}/`)
  }

  // Route-level RBAC: the sidebar already hides links a user can't reach,
  // but that's UI-only — this is what stops someone hitting the URL directly.
  const requiredPermission = findRequiredPermission(pathname, navRoutePermissions)
  const allowed = hasRoutePermission(user, requiredPermission)
  const groups = visibleNavGroups(user.permissions, user.isSuperadmin, user.roleSlugs)

  return (
    <CurrentUserProvider user={user}>
      <ActiveOutletProvider>
      <RealtimeInvalidationProvider />
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
                <HeaderDepartmentSwitcher />
                <Separator orientation="vertical" className="mx-1 h-6" />
                <ThemeToggle />
                <NotificationBell />
                <Separator orientation="vertical" className="mx-1 h-6" />
                <UserMenu />
              </div>
            </header>
            <main className="flex flex-1 flex-col p-4 sm:p-6">{allowed ? children : <AccessDenied />}</main>
          </div>
        </AppSidebarShell>
      </div>
      </ActiveOutletProvider>
    </CurrentUserProvider>
  )
}

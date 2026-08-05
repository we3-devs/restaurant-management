import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/dal"
import { CurrentUserProvider } from "@/lib/auth/current-user-context"
import { findRequiredPermission, getLandingPath, hasRoutePermission } from "@/lib/auth/route-access"
import { ActiveOutletProvider } from "@/lib/outlet/active-outlet-context"
import { AccessDenied } from "@/components/access-denied"
import { HeaderDepartmentSwitcher } from "./header-department-switcher"
import { HeaderOutletSwitcher } from "./header-outlet-switcher"
import { HeaderSearchButton } from "./header-search-button"
import { MobileNavToggle } from "./mobile-nav-toggle"
import { NotificationBell } from "./notification-bell"
import { navRoutePermissions } from "./nav-items"
import { SidebarShell } from "./sidebar-shell"
import { UserMenu } from "./user-menu"
import { RealtimeInvalidationProvider } from "./realtime-invalidation-provider"
import { DashboardBackgroundPrefetch } from "./dashboard-background-prefetch"
import { CommandPalette } from "@/components/command-palette"
import { OfflineIndicator } from "@/components/offline-indicator"
import { ThemeToggle } from "@/components/theme-toggle"
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
  if (pathname === "/dashboard" && getLandingPath(user) === "/staff") {
    redirect("/staff")
  }

  // Route-level RBAC: the sidebar already hides links a user can't reach,
  // but that's UI-only — this is what stops someone hitting the URL directly.
  const requiredPermission = findRequiredPermission(pathname, navRoutePermissions)
  const allowed = hasRoutePermission(user, requiredPermission)

  return (
    <CurrentUserProvider user={user}>
      <ActiveOutletProvider>
      <RealtimeInvalidationProvider />
      <DashboardBackgroundPrefetch />
      <CommandPalette />
      <div className="flex min-h-screen">
        <SidebarShell permissions={user.permissions} isSuperadmin={user.isSuperadmin} roleSlugs={user.roleSlugs}>
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
        </SidebarShell>
      </div>
      </ActiveOutletProvider>
    </CurrentUserProvider>
  )
}

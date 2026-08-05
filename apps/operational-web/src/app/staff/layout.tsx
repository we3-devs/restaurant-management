import { headers } from "next/headers"
import { getCurrentUser } from "@rms/auth/dal"
import { CurrentUserProvider } from "@rms/auth/current-user-context"
import { findRequiredPermission, hasRoutePermission } from "@rms/auth/route-access"
import { ActiveOutletProvider } from "@rms/api-client/outlet/active-outlet-context"
import { AccessDenied } from "@rms/ui/access-denied"
import { StaffHeader } from "./staff-header"
import { StaffTabBar } from "./staff-tab-bar"
import { StaffOfflineBanner } from "./staff-offline-banner"
import { RegisterStaffServiceWorker } from "./register-sw"
import { staffRoutePermissions } from "./nav-items"

/**
 * Mobile-first shell for kitchen/waiter staff — separate from
 * (dashboard)'s desktop sidebar shell (see AGENTS.md audit notes). Auth
 * gating mirrors (dashboard)/layout.tsx exactly: getCurrentUser() redirects
 * to /login on an invalid session, and everything below reads the result
 * from CurrentUserProvider instead of re-fetching. Route-level permission
 * checks also mirror (dashboard)/layout.tsx — the tab bar only hides items,
 * it doesn't stop a direct URL hit.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  const pathname = (await headers()).get("x-pathname") ?? ""
  const requiredPermission = findRequiredPermission(pathname, staffRoutePermissions)
  const allowed = hasRoutePermission(user, requiredPermission)

  return (
    <CurrentUserProvider user={user}>
      <ActiveOutletProvider>
        <div
          className="flex min-h-dvh flex-col bg-background"
          style={{
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          }}
        >
          <StaffHeader />
          <RegisterStaffServiceWorker />
          <StaffOfflineBanner />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            {allowed ? children : <AccessDenied />}
          </main>
          <StaffTabBar />
        </div>
      </ActiveOutletProvider>
    </CurrentUserProvider>
  )
}

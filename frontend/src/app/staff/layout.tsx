import { getCurrentUser } from "@/lib/auth/dal"
import { CurrentUserProvider } from "@/lib/auth/current-user-context"
import { ActiveOutletProvider } from "@/lib/outlet/active-outlet-context"
import { StaffHeader } from "./staff-header"
import { StaffTabBar } from "./staff-tab-bar"
import { StaffOfflineBanner } from "./staff-offline-banner"
import { RegisterStaffServiceWorker } from "./register-sw"

/**
 * Mobile-first shell for kitchen/waiter staff — separate from
 * (dashboard)'s desktop sidebar shell (see AGENTS.md audit notes). Auth
 * gating mirrors (dashboard)/layout.tsx exactly: getCurrentUser() redirects
 * to /login on an invalid session, and everything below reads the result
 * from CurrentUserProvider instead of re-fetching.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

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
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">{children}</main>
          <StaffTabBar />
        </div>
      </ActiveOutletProvider>
    </CurrentUserProvider>
  )
}

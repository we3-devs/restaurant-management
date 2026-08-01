import { getCurrentUser } from "@/lib/auth/dal"
import { CurrentUserProvider } from "@/lib/auth/current-user-context"
import { ActiveOutletProvider } from "@/lib/outlet/active-outlet-context"
import { DashboardNav } from "./dashboard-nav"
import { MobileNavToggle } from "./mobile-nav-toggle"
import { NotificationBell } from "./notification-bell"
import { LogoutButton } from "./logout-button"
import { WhoAmIButton } from "./whoami-button"
import { RealtimeInvalidationProvider } from "./realtime-invalidation-provider"
import { CommandPalette } from "@/components/command-palette"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The real auth check — proxy.ts only did an optimistic cookie check. This
  // is the only /auth/me call in the tree; everything below reads the result
  // from CurrentUserProvider instead of fetching it again.
  const user = await getCurrentUser()

  return (
    <CurrentUserProvider user={user}>
      <ActiveOutletProvider>
      <RealtimeInvalidationProvider />
      <CommandPalette />
      <div className="flex min-h-screen">
        <aside
          id="dashboard-sidebar"
          className="fixed inset-y-0 left-0 z-40 w-64 shrink-0 -translate-x-full border-r bg-sidebar transition-transform max-lg:shadow-xl lg:static lg:translate-x-0"
        >
          <div className="flex h-14 items-center gap-2 border-b px-4">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              R
            </span>
            <span className="font-semibold tracking-tight">RMS</span>
          </div>
          <div className="h-[calc(100%-3.5rem)]">
            <DashboardNav permissions={user.permissions} isSuperadmin={user.isSuperadmin} />
          </div>
        </aside>

        <div
          id="dashboard-sidebar-backdrop"
          className="fixed inset-0 z-30 hidden bg-black/40 lg:hidden"
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-6">
            <MobileNavToggle />
            <div className="flex flex-1 items-center justify-end gap-4 text-sm">
              <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
              <WhoAmIButton />
              <NotificationBell />
              <LogoutButton />
            </div>
          </header>
          <main className="flex flex-1 flex-col p-4 sm:p-6">{children}</main>
        </div>
      </div>
      </ActiveOutletProvider>
    </CurrentUserProvider>
  )
}

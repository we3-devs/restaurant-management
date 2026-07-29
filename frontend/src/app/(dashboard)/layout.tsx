import { getCurrentUser } from "@/lib/auth/dal"
import { DashboardNav } from "./dashboard-nav"
import { LogoutButton } from "./logout-button"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The real auth check — proxy.ts only did an optimistic cookie check.
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">RMS</span>
          <DashboardNav permissions={user.permissions} isSuperadmin={user.isSuperadmin} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col p-6">{children}</main>
    </div>
  )
}

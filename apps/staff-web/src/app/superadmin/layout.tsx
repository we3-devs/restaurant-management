import { getCurrentUser } from "@rms/auth/dal"
import { CurrentUserProvider } from "@rms/auth/current-user-context"
import { AccessDenied } from "@rms/ui/access-denied"
import { DashboardChrome } from "../dashboard/(dashboard)/dashboard-chrome"

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user.isSuperadmin) return <AccessDenied />

  return (
    <CurrentUserProvider user={user}>
      <DashboardChrome
        permissions={user.permissions}
        isSuperadmin={user.isSuperadmin}
        roleSlugs={user.roleSlugs}
        allowed
      >
        {children}
      </DashboardChrome>
    </CurrentUserProvider>
  )
}

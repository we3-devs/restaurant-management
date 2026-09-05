import { getCurrentUser } from "@rms/auth/dal"
import { CurrentUserProvider } from "@rms/auth/current-user-context"
import { AccessDenied } from "@rms/ui/access-denied"
import { BrandColor } from "@rms/api-client/brand-color"
import { ActiveOutletProvider } from "@rms/api-client/outlet/active-outlet-context"
import { RealtimeInvalidationProvider } from "@rms/api-client/realtime-invalidation-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { DashboardChrome } from "../dashboard/(dashboard)/dashboard-chrome"

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user.isSuperadmin) return <AccessDenied />

  return (
    <QueryProvider>
      <BrandColor />
      <CurrentUserProvider user={user}>
        <ActiveOutletProvider>
          <RealtimeInvalidationProvider />
          <DashboardChrome
            permissions={user.permissions}
            isSuperadmin={user.isSuperadmin}
            roleSlugs={user.roleSlugs}
            allowed
          >
            {children}
          </DashboardChrome>
        </ActiveOutletProvider>
      </CurrentUserProvider>
    </QueryProvider>
  )
}

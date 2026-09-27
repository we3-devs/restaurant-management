import { headers } from "next/headers"
import { getCurrentUser } from "@rms/auth/dal"
import { CurrentUserProvider } from "@rms/auth/current-user-context"
import { findRequiredPermission, hasRoutePermission } from "@rms/auth/route-access"
import { ActiveOutletProvider } from "@rms/api-client/outlet/active-outlet-context"
import { RealtimeInvalidationProvider } from "@rms/api-client/realtime-invalidation-provider"
import { QueryProvider } from "@rms/api-client/query-provider"
import { fetchBranding } from "@rms/api-client/branding"
import { StaticBrandColor } from "@rms/api-client/brand-color"
import { BACKEND_API_BASE } from "@/lib/server/backend-client"
import { brandingHeaders } from "@/lib/tenant"
import { navRoutePermissions } from "./nav-items"
import { OperationalChrome } from "./operational-chrome"

export default async function OperationalLayout({ children }: { children: React.ReactNode }) {
  // The real auth check — proxy.ts only did an optimistic cookie check.
  // Branding is fetched in parallel — independent of auth, no waterfall.
  const [user, branding] = await Promise.all([
    getCurrentUser(),
    fetchBranding(BACKEND_API_BASE, await brandingHeaders()),
  ])

  const pathname = (await headers()).get("x-pathname") ?? ""

  // Route-level RBAC: the sidebar already hides links a user can't reach,
  // but that's UI-only — this is what stops someone hitting the URL directly.
  const requiredPermission = findRequiredPermission(pathname, navRoutePermissions)
  const allowed = hasRoutePermission(user, requiredPermission)

  return (
    <QueryProvider persist userId={user.id}>
      <StaticBrandColor primaryColor={branding.primaryColor} />
      <CurrentUserProvider user={user}>
        <ActiveOutletProvider>
          <RealtimeInvalidationProvider />
          <OperationalChrome permissions={user.permissions} allowed={allowed}>
            {children}
          </OperationalChrome>
        </ActiveOutletProvider>
      </CurrentUserProvider>
    </QueryProvider>
  )
}

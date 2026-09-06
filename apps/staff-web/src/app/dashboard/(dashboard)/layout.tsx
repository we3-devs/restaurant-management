import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@rms/auth/dal"
import { CurrentUserProvider } from "@rms/auth/current-user-context"
import { findRequiredPermission, getLandingPath, hasRoutePermission } from "@rms/auth/route-access"
import { ActiveOutletProvider } from "@rms/api-client/outlet/active-outlet-context"
import { RealtimeInvalidationProvider } from "@rms/api-client/realtime-invalidation-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { BrandColor } from "@rms/api-client/brand-color"
import { navRoutePermissions } from "./nav-items"
import { DashboardChrome } from "./dashboard-chrome"

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
    redirect("/operational/staff")
  }

  // Route-level RBAC: the sidebar already hides links a user can't reach,
  // but that's UI-only — this is what stops someone hitting the URL directly.
  const requiredPermission = findRequiredPermission(pathname, navRoutePermissions)
  const allowed = hasRoutePermission(user, requiredPermission)

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
            allowed={allowed}
          >
            {children}
          </DashboardChrome>
        </ActiveOutletProvider>
      </CurrentUserProvider>
    </QueryProvider>
  )
}

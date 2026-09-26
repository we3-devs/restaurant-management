import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { backendFetch } from "./server/backend-client"

export interface CurrentUser {
  id: number
  name: string
  email: string
  /** Hotel/company this user belongs to. */
  tenantId: number | null
  permissions: string[]
  /** Slugs of every active position linked to this user. */
  positionSlugs: string[]
  /** Which app this user lands in after login. Legacy values may still appear as "operational" until the backend data is cleaned up. */
  portal: "dashboard" | "staff" | "operational"
  /** Whether the user can reach both the dashboard and staff apps — drives the header portal switcher. */
  hasBothPortals: boolean
  /** Outlets this user's active employee assignments provide access to. */
  outletIds: number[]
  /** Outlet-departments this user's active employee assignments provide access to. */
  departmentIds: number[]
}

/**
 * The real (non-optimistic) auth check: calls the backend's /auth/me, which
 * validates the JWT server-side. Memoized per request via React's cache().
 * Redirects to /login if there's no valid session — proxy.ts only does a
 * cheap cookie-presence check, this is the actual gate.
 */
export const verifySession = cache(async (): Promise<CurrentUser> => {
  // No in-render refresh: Server Components can't write cookies, so it would
  // rotate the refresh token without the browser ever receiving the new one,
  // and the browser's next refresh would replay the rotated-away token and
  // trip reuse detection. proxy.ts refreshes ahead of every render; if the
  // access token is still rejected here, detour through the refresh Route
  // Handler (which can persist cookies) and come back.
  const response = await backendFetch("/auth/me", {}, { refresh: false })
  if (response.status === 401) {
    const returnTo = (await headers()).get("x-pathname") ?? "/"
    redirect(`/api/auth/refresh?next=${encodeURIComponent(returnTo)}`)
  }
  if (response.status === 403) {
    redirect("/api/auth/clear-session")
  }
  if (!response.ok) {
    // Backend hiccup (5xx, cold start) — the session may be fine, so surface
    // an error instead of logging the user out.
    throw new Error(`Session check failed with status ${response.status}`)
  }
  return (await response.json()) as CurrentUser
})

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  return verifySession()
})

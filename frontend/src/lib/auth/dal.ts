import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { backendFetch, BackendUnauthorizedError } from "@/lib/server/backend-client"

export interface CurrentUser {
  id: number
  name: string
  email: string
  isSuperadmin: boolean
  permissions: string[]
  /** Which app this user lands in after login — aggregated server-side from their role assignments' explicit `portal` field. */
  portal: "dashboard" | "staff"
  /** Outlets this user holds an outlet-scoped role assignment for. Empty means global/unscoped access — treat as "every outlet". */
  outletIds: number[]
  /** Outlet-departments this user holds a department-scoped role assignment for. Empty means no specific department assignment. */
  departmentIds: number[]
}

/**
 * The real (non-optimistic) auth check: calls the backend's /auth/me, which
 * validates the JWT server-side. Memoized per request via React's cache().
 * Redirects to /login if there's no valid session — proxy.ts only does a
 * cheap cookie-presence check, this is the actual gate.
 */
export const verifySession = cache(async (): Promise<CurrentUser> => {
  try {
    const response = await backendFetch("/auth/me")
    if (!response.ok) {
      redirect("/login")
    }
    return (await response.json()) as CurrentUser
  } catch (error) {
    if (error instanceof BackendUnauthorizedError) {
      redirect("/login")
    }
    throw error
  }
})

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  return verifySession()
})

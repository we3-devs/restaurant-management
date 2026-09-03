import "server-only"

import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "../session"
import { sessionFetch } from "./session-fetch"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

/** Same origin the authenticated helpers below use, for unauthenticated server-side reads (e.g. branding in generateMetadata). */
export const BACKEND_API_BASE = `${BACKEND_URL}/api`

export class BackendUnauthorizedError extends Error {
  constructor() {
    super("Session expired or invalid")
    this.name = "BackendUnauthorizedError"
  }
}


/**
 * Server-only fetch wrapper for calling the NestJS backend. Attaches the
 * access token from cookies, and on a 401 tries exactly one refresh + retry
 * before giving up. Callers decide what to do with BackendUnauthorizedError
 * (the DAL redirects to /login, the API proxy route returns 401 to the client).
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return sessionFetch(
    {
      backendUrl: BACKEND_URL,
      refreshPath: "/auth/refresh",
      getAccessToken,
      getRefreshToken,
      setTokens: setAuthCookies,
      clearSession: clearAuthCookies,
      unauthorizedError: new BackendUnauthorizedError(),
      scope: "staff",
    },
    path,
    init,
  )
}

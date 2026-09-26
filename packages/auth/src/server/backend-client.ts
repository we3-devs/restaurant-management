import "server-only"

import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "../session"
import { sessionFetch, type SessionFetchOptions } from "./session-fetch"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

/** Same origin the authenticated helpers below use, for unauthenticated server-side reads (e.g. branding in generateMetadata). */
export const BACKEND_API_BASE = `${BACKEND_URL}/api`

export class BackendUnauthorizedError extends Error {
  constructor() {
    super("Session expired or invalid")
    this.name = "BackendUnauthorizedError"
  }
}

/** The session couldn't be refreshed right now (backend unreachable/5xx) — the session itself may be fine, so this must never be treated as a logout. */
export class BackendUnavailableError extends Error {
  constructor() {
    super("Authentication service is temporarily unavailable")
    this.name = "BackendUnavailableError"
  }
}


/**
 * Server-only fetch wrapper for calling the NestJS backend. Attaches the
 * access token from cookies, and on a 401 tries exactly one refresh + retry
 * before giving up. Callers decide what to do with BackendUnauthorizedError
 * (the DAL redirects to /login, the API proxy route returns 401 to the client)
 * and BackendUnavailableError (retryable; never a logout).
 */
export async function backendFetch(
  path: string,
  init: RequestInit = {},
  options: SessionFetchOptions = {},
): Promise<Response> {
  return sessionFetch(
    {
      backendUrl: BACKEND_URL,
      refreshPath: "/auth/refresh",
      getAccessToken,
      getRefreshToken,
      setTokens: setAuthCookies,
      clearSession: clearAuthCookies,
      unauthorizedError: new BackendUnauthorizedError(),
      unavailableError: new BackendUnavailableError(),
      scope: "staff",
    },
    path,
    init,
    undefined,
    options,
  )
}

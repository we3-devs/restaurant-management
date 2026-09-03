import "server-only"

import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "../session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

/** Same origin the authenticated helpers below use, for unauthenticated server-side reads (e.g. branding in generateMetadata). */
export const BACKEND_API_BASE = `${BACKEND_URL}/api`

export class BackendUnauthorizedError extends Error {
  constructor() {
    super("Session expired or invalid")
    this.name = "BackendUnauthorizedError"
  }
}

async function rawFetch(path: string, init: RequestInit, accessToken?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(`${BACKEND_URL}/api${path}`, { ...init, headers, cache: "no-store" })
}

let refreshInFlight: { refreshToken: string; promise: Promise<string | null> } | null = null

async function rotateRefreshToken(refreshToken: string): Promise<string | null> {
  const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string }
  await setAuthCookies({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return data.accessToken
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    return null
  }

  // Refresh tokens rotate on every use. Without this gate, a burst of
  // parallel API requests can all submit the same token; the first wins and
  // the others fail, incorrectly logging the user out.
  if (refreshInFlight?.refreshToken === refreshToken) {
    return refreshInFlight.promise
  }

  const promise = rotateRefreshToken(refreshToken).finally(() => {
    if (refreshInFlight?.promise === promise) {
      refreshInFlight = null
    }
  })
  refreshInFlight = { refreshToken, promise }
  return promise
}

/**
 * Server-only fetch wrapper for calling the NestJS backend. Attaches the
 * access token from cookies, and on a 401 tries exactly one refresh + retry
 * before giving up. Callers decide what to do with BackendUnauthorizedError
 * (the DAL redirects to /login, the API proxy route returns 401 to the client).
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken()
  const firstAttempt = await rawFetch(path, init, accessToken)

  if (firstAttempt.status !== 401) {
    return firstAttempt
  }

  const refreshedAccessToken = await tryRefresh()
  if (!refreshedAccessToken) {
    await clearAuthCookies()
    throw new BackendUnauthorizedError()
  }

  return rawFetch(path, init, refreshedAccessToken)
}

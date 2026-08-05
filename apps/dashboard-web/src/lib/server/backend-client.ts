import "server-only"

import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth/session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

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

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    return null
  }

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

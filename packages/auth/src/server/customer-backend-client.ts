import "server-only"

import {
  clearCustomerSession,
  getCustomerRefreshToken,
  getCustomerToken,
  setCustomerSession,
} from "../customer-session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

export class CustomerUnauthorizedError extends Error {
  constructor() {
    super("Customer session expired or invalid")
    this.name = "CustomerUnauthorizedError"
  }
}

async function rawFetch(path: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(`${BACKEND_URL}/api${path}`, { ...init, headers, cache: "no-store" })
}

/**
 * Rotates the refresh cookie for a new pair. Returns the new access token, or
 * null when there's nothing to refresh with / the refresh itself failed.
 * Writing the cookies is best-effort (see setCustomerSession) — the caller
 * still gets a usable token back for the current request regardless.
 */
async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getCustomerRefreshToken()
  if (!refreshToken) return null

  const response = await fetch(`${BACKEND_URL}/api/customer-auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })
  if (!response.ok) return null

  const data = (await response.json()) as { accessToken: string; refreshToken: string }
  await setCustomerSession(data)
  return data.accessToken
}

/**
 * Server-only fetch wrapper for the customer portal / QR-ordering endpoints.
 * Attaches the customer/guest access token from cookies and, on a 401, tries
 * exactly one refresh + retry before giving up — mirroring backendFetch for
 * staff.
 */
export async function customerBackendFetch(
  path: string,
  init: RequestInit = {},
  // Lets the /api/customer-backend proxy pass through a token the client sent
  // explicitly (from its localStorage backstop — see
  // client/customer-token-storage.ts). When this is set the client owns the
  // refresh cycle, so a 401 here is terminal rather than server-refreshed.
  tokenOverride?: string,
): Promise<Response> {
  if (tokenOverride) {
    const response = await rawFetch(path, init, tokenOverride)
    if (response.status === 401) throw new CustomerUnauthorizedError()
    return response
  }

  const accessToken = await getCustomerToken()
  const firstAttempt = await rawFetch(path, init, accessToken)
  if (firstAttempt.status !== 401) return firstAttempt

  const refreshed = await tryRefresh()
  if (!refreshed) {
    await clearCustomerSession()
    throw new CustomerUnauthorizedError()
  }
  return rawFetch(path, init, refreshed)
}

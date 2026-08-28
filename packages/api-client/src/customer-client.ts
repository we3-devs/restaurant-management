import {
  getStoredCustomerRefreshToken,
  getStoredCustomerToken,
  setStoredCustomerToken,
} from "@rms/auth/client/customer-token-storage"

/**
 * Browser-side fetch wrapper for the customer portal / guest-ordering proxy
 * (mirrors client.ts's apiClient, different base path). Normally the proxy
 * authenticates via the httpOnly cookie server-side, but this also sends
 * along the localStorage backstop token (if one was saved at sign-in) as an
 * explicit Authorization header — see customer-token-storage.ts and the
 * proxy route, which prefers this header over the cookie when both exist.
 *
 * On a 401 it rotates the stored refresh token once (via /api/customer-auth/
 * refresh) and retries — the client-side half of the "access token expires,
 * app silently refreshes it, user notices nothing" flow.
 */
async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  const token = getStoredCustomerToken()
  return fetch(`/api/customer-backend${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
}

let inFlightRefresh: Promise<boolean> | null = null

async function refreshOnce(): Promise<boolean> {
  const refreshToken = getStoredCustomerRefreshToken()
  if (!refreshToken) return false

  // Collapse concurrent 401s onto a single refresh round trip.
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const response = await fetch("/api/customer-auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        })
        if (!response.ok) return false
        const data = (await response.json()) as { accessToken: string; refreshToken: string }
        setStoredCustomerToken(data.accessToken, data.refreshToken)
        return true
      } catch {
        return false
      }
    })()
    void inFlightRefresh.finally(() => {
      inFlightRefresh = null
    })
  }

  return inFlightRefresh
}

export async function customerApiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await rawRequest(path, init)

  if (response.status === 401 && (await refreshOnce())) {
    response = await rawRequest(path, init)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? `Request to ${path} failed with ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

import { getStoredCustomerToken } from "@rms/auth/client/customer-token-storage"

/**
 * Browser-side fetch wrapper for the customer portal / guest-ordering proxy
 * (mirrors client.ts's apiClient, different base path). Normally the proxy
 * authenticates via the httpOnly cookie server-side, but this also sends
 * along the localStorage backstop token (if one was saved at sign-in) as an
 * explicit Authorization header — see customer-token-storage.ts and the
 * proxy route, which prefers this header over the cookie when both exist.
 */
export async function customerApiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredCustomerToken()
  const response = await fetch(`/api/customer-backend${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? `Request to ${path} failed with ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

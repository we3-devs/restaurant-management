/** Same as Error, plus the HTTP status — lets callers (e.g. the offline mutation queue) distinguish a 400 from a 404/500 without reparsing the message. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * "invalid" (the refresh endpoint returned 401 — the backend definitively
 * rejected the refresh token) is the only case that should force a logout.
 * "transient" (network error, or the refresh endpoint's own 503 for a
 * backend hiccup) must NOT — that was the bug: a momentary blip while
 * refreshing (e.g. a cold-starting backend) got treated the same as an
 * actually-dead session and hard-redirected the user to /login.
 */
type RefreshOutcome = "ok" | "invalid" | "transient"

let staffRefreshInFlight: Promise<RefreshOutcome> | null = null

async function refreshStaffSession(): Promise<RefreshOutcome> {
  if (staffRefreshInFlight) return staffRefreshInFlight
  staffRefreshInFlight = fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  })
    .then((response): RefreshOutcome => (response.ok ? "ok" : response.status === 401 ? "invalid" : "transient"))
    .catch((): RefreshOutcome => "transient")
    .finally(() => {
      staffRefreshInFlight = null
    })
  return staffRefreshInFlight
}

/**
 * Browser-side fetch wrapper. Always hits the same-origin proxy at
 * /api/backend/*, never the NestJS origin directly — the proxy attaches the
 * token server-side, so no token or CORS handling is needed here.
 */
export async function apiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = () => {
    const headers = new Headers(init.headers)
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json")
    // Superadmins choose the tenant in the header. Reading this at request
    // time keeps every query/mutation in sync without threading tenant props
    // through every hook.
    if (typeof window !== "undefined") {
      const tenantSlug = window.localStorage.getItem("active-tenant-slug")
      if (tenantSlug) headers.set("X-Tenant-Slug", tenantSlug)
      else headers.delete("X-Tenant-Slug")
    }
    return fetch(`/api/backend${path}`, {
    ...init,
      headers,
    })
  }
  let response = await request()

  // The proxy normally refreshes server-side. This fallback covers an
  // already-returned 401 and collapses simultaneous expired requests into a
  // single refresh/rotation before replaying the original request once.
  if (response.status === 401) {
    const outcome = await refreshStaffSession()
    if (outcome === "ok") {
      response = await request()
    } else if (outcome === "invalid" && typeof window !== "undefined") {
      // Refresh token is gone/expired too — there's no session to recover.
      // The client-side auth context has no way to react to this on its
      // own, so force a hard navigation to drop stale state and hit the
      // login page's own session check.
      window.location.href = "/login"
      return new Promise<T>(() => {})
    }
    // "transient" falls through and lets the original 401 surface as an
    // ApiError below — the caller (react-query) can retry rather than the
    // user getting logged out over a momentary backend hiccup.
  }

  if (!response.ok) {
    const body = await readJson<{ message?: string }>(response)
    throw new ApiError(body?.message ?? `Request to ${path} failed with ${response.status}`, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  // response.ok is already established above — an empty or non-JSON body on
  // a successful response (e.g. a 200 with no content) is not an error, so
  // it's returned as-is rather than thrown.
  const body = await readJson<T>(response)
  return body as T
}

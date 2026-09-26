import "server-only"

export interface SessionFetchConfig {
  backendUrl: string
  refreshPath: string
  getAccessToken: () => Promise<string | undefined>
  getRefreshToken: () => Promise<string | undefined>
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
  clearSession: () => Promise<void>
  unauthorizedError: Error
  /** Thrown when the refresh fails for a transient reason (backend unreachable/5xx), so callers can tell it apart from a dead session. Defaults to unauthorizedError. */
  unavailableError?: Error
  scope: string
}

export interface SessionFetchOptions {
  /**
   * false returns the backend's 401 as-is instead of refreshing. Server
   * Components can't write cookies, so a refresh there would rotate the
   * refresh token without ever handing the new one to the browser — the
   * caller redirects through a Route Handler that can persist it instead.
   */
  refresh?: boolean
}

type AuthTokens = { accessToken: string; refreshToken: string }

/**
 * `invalid: true` means the backend explicitly rejected the refresh token
 * (expired/reused/revoked) — the session really is gone. Anything else
 * (network error, backend 5xx/cold-start) is transient: the refresh token
 * itself may still be perfectly good, so the caller must NOT clear the
 * session over it — that was exactly the bug where a momentary blip during
 * refresh (e.g. a sleeping Render instance waking up) wiped a still-valid
 * session and looked like a random logout.
 */
type RefreshResult = { tokens: AuthTokens | null; invalid: boolean }

// Keyed per scope + refresh token (a Map, not a single slot): this server
// instance handles every logged-in user at once, and a single slot got
// clobbered as soon as a second user's refresh started, sending the first
// user's later requests off to redeem their token again — the same race
// proxy.ts's refreshInFlight map already closes for middleware.
const refreshInFlight = new Map<string, Promise<RefreshResult>>()

async function fetchWithToken(url: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  return fetch(url, { ...init, headers, cache: "no-store" })
}

async function redeem(config: SessionFetchConfig, refreshToken: string): Promise<RefreshResult> {
  let response: Response
  try {
    response = await fetch(`${config.backendUrl}/api${config.refreshPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    })
  } catch {
    return { tokens: null, invalid: false }
  }
  if (!response.ok) {
    return { tokens: null, invalid: response.status === 401 || response.status === 403 }
  }
  const tokens = (await response.json()) as AuthTokens
  return { tokens, invalid: false }
}

async function refresh(config: SessionFetchConfig): Promise<RefreshResult> {
  const refreshToken = await config.getRefreshToken()
  if (!refreshToken) return { tokens: null, invalid: true }

  const key = `${config.scope}:${refreshToken}`
  let promise = refreshInFlight.get(key)
  if (!promise) {
    promise = redeem(config, refreshToken).finally(() => {
      refreshInFlight.delete(key)
    })
    refreshInFlight.set(key, promise)
  }
  const result = await promise
  // Persist from every caller, not just the one that started the redeem:
  // cookies() is bound to the calling request, so only this request's
  // response carries the Set-Cookie. If the first response is aborted or
  // discarded by the browser, the others still deliver the new tokens.
  if (result.tokens) await config.setTokens(result.tokens)
  return result
}

export async function sessionFetch(
  config: SessionFetchConfig,
  path: string,
  init: RequestInit = {},
  tokenOverride?: string,
  options: SessionFetchOptions = {},
) {
  if (tokenOverride) {
    const response = await fetchWithToken(`${config.backendUrl}/api${path}`, init, tokenOverride)
    if (response.status === 401) throw config.unauthorizedError
    return response
  }
  const firstAttempt = await fetchWithToken(`${config.backendUrl}/api${path}`, init, await config.getAccessToken())
  if (firstAttempt.status !== 401 || options.refresh === false) return firstAttempt

  const result = await refresh(config)
  if (!result.tokens) {
    // Only wipe cookies when the backend definitively rejected the refresh
    // token. A transient failure just fails this one request — the (still
    // valid) refresh token stays put so the next request can try again.
    if (result.invalid) {
      await config.clearSession()
      throw config.unauthorizedError
    }
    throw config.unavailableError ?? config.unauthorizedError
  }
  return fetchWithToken(`${config.backendUrl}/api${path}`, init, result.tokens.accessToken)
}

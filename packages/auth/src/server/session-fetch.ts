import "server-only"

export interface SessionFetchConfig {
  backendUrl: string
  refreshPath: string
  getAccessToken: () => Promise<string | undefined>
  getRefreshToken: () => Promise<string | undefined>
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
  clearSession: () => Promise<void>
  unauthorizedError: Error
  scope: string
}

/**
 * `invalid: true` means the backend explicitly rejected the refresh token
 * (expired/reused/revoked) — the session really is gone. Anything else
 * (network error, backend 5xx/cold-start) is transient: the refresh token
 * itself may still be perfectly good, so the caller must NOT clear the
 * session over it — that was exactly the bug where a momentary blip during
 * refresh (e.g. a sleeping Render instance waking up) wiped a still-valid
 * session and looked like a random logout.
 */
type RefreshResult = { token: string | null; invalid: boolean }
type RefreshState = { key: string; promise: Promise<RefreshResult> }
let refreshInFlight: RefreshState | null = null

async function fetchWithToken(url: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  return fetch(url, { ...init, headers, cache: "no-store" })
}

async function refresh(config: SessionFetchConfig): Promise<RefreshResult> {
  const refreshToken = await config.getRefreshToken()
  if (!refreshToken) return { token: null, invalid: true }

  const key = `${config.scope}:${refreshToken}`
  if (refreshInFlight?.key === key) return refreshInFlight.promise

  const promise = (async (): Promise<RefreshResult> => {
    let response: Response
    try {
      response = await fetch(`${config.backendUrl}/api${config.refreshPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      })
    } catch {
      return { token: null, invalid: false }
    }
    if (!response.ok) {
      return { token: null, invalid: response.status === 401 || response.status === 403 }
    }
    const tokens = (await response.json()) as { accessToken: string; refreshToken: string }
    await config.setTokens(tokens)
    return { token: tokens.accessToken, invalid: false }
  })().finally(() => {
    if (refreshInFlight?.promise === promise) refreshInFlight = null
  })

  refreshInFlight = { key, promise }
  return promise
}

export async function sessionFetch(
  config: SessionFetchConfig,
  path: string,
  init: RequestInit = {},
  tokenOverride?: string,
) {
  if (tokenOverride) {
    const response = await fetchWithToken(`${config.backendUrl}/api${path}`, init, tokenOverride)
    if (response.status === 401) throw config.unauthorizedError
    return response
  }
  const firstAttempt = await fetchWithToken(`${config.backendUrl}/api${path}`, init, await config.getAccessToken())
  if (firstAttempt.status !== 401) return firstAttempt

  const result = await refresh(config)
  if (!result.token) {
    // Only wipe cookies when the backend definitively rejected the refresh
    // token. A transient failure just fails this one request — the (still
    // valid) refresh token stays put so the next request can try again.
    if (result.invalid) await config.clearSession()
    throw config.unauthorizedError
  }
  return fetchWithToken(`${config.backendUrl}/api${path}`, init, result.token)
}

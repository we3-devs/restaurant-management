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

type RefreshState = { key: string; promise: Promise<string | null> }
let refreshInFlight: RefreshState | null = null

async function fetchWithToken(url: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  return fetch(url, { ...init, headers, cache: "no-store" })
}

async function refresh(config: SessionFetchConfig): Promise<string | null> {
  const refreshToken = await config.getRefreshToken()
  if (!refreshToken) return null

  const key = `${config.scope}:${refreshToken}`
  if (refreshInFlight?.key === key) return refreshInFlight.promise

  const promise = (async () => {
    const response = await fetch(`${config.backendUrl}/api${config.refreshPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    })
    if (!response.ok) return null
    const tokens = (await response.json()) as { accessToken: string; refreshToken: string }
    await config.setTokens(tokens)
    return tokens.accessToken
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

  const token = await refresh(config)
  if (!token) {
    await config.clearSession()
    throw config.unauthorizedError
  }
  return fetchWithToken(`${config.backendUrl}/api${path}`, init, token)
}

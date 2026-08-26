import "server-only"

import { cookies } from "next/headers"

export const ACCESS_TOKEN_COOKIE = "access_token"
export const REFRESH_TOKEN_COOKIE = "refresh_token"

// Mirrors the backend's JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN defaults.
// Refresh token is long-lived (400d, the max browsers allow) so a login
// persists until explicit logout or the user clears site data — the short
// access token is silently refreshed underneath it (see backend-client.ts).
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60
const REFRESH_TOKEN_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

// Unset for local dev (cookies scope by host only, not port, so localhost
// already shares across apps on different ports). In production, set to a
// shared parent domain (e.g. ".example.com") so the session cookie set by
// one app's origin (e.g. admin.example.com) is also sent to the other
// (e.g. pos.example.com) — required now that dashboard-web and
// operational-web are separate deployments.
const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN

/** Sets both auth cookies. Only callable from a Route Handler or Server Action. */
export async function setAuthCookies(tokens: AuthTokens): Promise<void> {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === "production"

  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  })

  cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  })
}

/**
 * Best-effort: also called from backendFetch's refresh-failure path, which
 * runs during Server Component rendering (e.g. the dashboard layout) as well
 * as from Route Handlers/Server Actions. Next.js only allows cookie mutation
 * in the latter two, so during a render this throws — swallow that case
 * rather than letting it crash the page, since the caller redirects to
 * /login regardless and the stale cookies just expire naturally.
 */
export async function clearAuthCookies(): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete({ name: ACCESS_TOKEN_COOKIE, path: "/", domain: COOKIE_DOMAIN })
    cookieStore.delete({ name: REFRESH_TOKEN_COOKIE, path: "/", domain: COOKIE_DOMAIN })
  } catch {
    // Called during render — cookies are read-only here, nothing to do.
  }
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
}

import "server-only"

import { cookies } from "next/headers"

export const ACCESS_TOKEN_COOKIE = "access_token"
export const REFRESH_TOKEN_COOKIE = "refresh_token"

// Mirrors the backend's JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN defaults.
// Refresh token is long-lived (400d, the max browsers allow) so a login
// persists until explicit logout or the user clears site data — the short
// access token is silently refreshed underneath it (see backend-client.ts).
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

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
export const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN

/** Shared cookie attributes, exported so proxy.ts (middleware — the one place that can reliably persist a refreshed token, see proxy.ts) can set matching cookies without duplicating these flags. */
export function authCookieAttributes(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge,
  }
}

/**
 * Sets both auth cookies. Only callable from a Route Handler or Server
 * Action — Next.js throws if invoked while a Server Component renders.
 * Most real refreshes now happen proactively in proxy.ts (middleware), which
 * can always persist cookies; this remains as the Route Handler path (e.g.
 * /api/backend/* reacting to a 401 mid-request) and is defensively wrapped
 * so a stray call from render context degrades to "not persisted" instead of
 * crashing the page.
 */
export async function setAuthCookies(tokens: AuthTokens): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, authCookieAttributes(ACCESS_TOKEN_MAX_AGE_SECONDS))
    cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, authCookieAttributes(REFRESH_TOKEN_MAX_AGE_SECONDS))
  } catch {
    // Called during render — cookies are read-only here, nothing to do.
  }
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

    // Clear the host-only form as well as the configured shared-domain form.
    // This matters after AUTH_COOKIE_DOMAIN is added or changed: browsers
    // retain cookies whose Domain attribute differs, which otherwise makes
    // proxy.ts keep redirecting /login back to the invalid session.
    for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
      cookieStore.delete({ name, path: "/" })
      if (COOKIE_DOMAIN) {
        cookieStore.delete({ name, path: "/", domain: COOKIE_DOMAIN })
      }
    }
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

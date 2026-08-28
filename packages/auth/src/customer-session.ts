import "server-only"

import { cookies } from "next/headers"

export const CUSTOMER_TOKEN_COOKIE = "customer_access_token"
export const CUSTOMER_REFRESH_TOKEN_COOKIE = "customer_refresh_token"

// Mirrors the backend's JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN. The
// access token is short-lived and silently rotated (see
// customer-backend-client.ts and customer-client.ts); the refresh token is
// long-lived so a customer/guest session survives browser restarts until an
// explicit logout or the refresh token itself is revoked server-side.
const CUSTOMER_ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60
const CUSTOMER_REFRESH_TOKEN_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

export interface CustomerTokens {
  accessToken: string
  refreshToken: string
}

/** Sets both customer cookies. Only callable from a Route Handler or Server Action. */
export async function setCustomerSession(tokens: CustomerTokens): Promise<void> {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === "production"
  const base = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  } as const

  cookieStore.set(CUSTOMER_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: CUSTOMER_ACCESS_TOKEN_MAX_AGE_SECONDS,
  })
  cookieStore.set(CUSTOMER_REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: CUSTOMER_REFRESH_TOKEN_MAX_AGE_SECONDS,
  })
}

/**
 * Best-effort: also called from customerBackendFetch's refresh path, which
 * can run during Server Component rendering where Next forbids cookie
 * mutation — swallow that case (the caller still uses the freshly-minted
 * token for the current request; the stale cookie just expires naturally).
 */
export async function clearCustomerSession(): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete({ name: CUSTOMER_TOKEN_COOKIE, path: "/" })
    cookieStore.delete({ name: CUSTOMER_REFRESH_TOKEN_COOKIE, path: "/" })
  } catch {
    // Called during render — cookies are read-only here, nothing to do.
  }
}

export async function getCustomerToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(CUSTOMER_TOKEN_COOKIE)?.value
}

export async function getCustomerRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(CUSTOMER_REFRESH_TOKEN_COOKIE)?.value
}

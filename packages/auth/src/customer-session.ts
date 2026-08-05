import "server-only"

import { cookies } from "next/headers"

export const CUSTOMER_TOKEN_COOKIE = "customer_access_token"

// Mirrors CustomerAuthService's signed-in-customer session expiry (30d).
const CUSTOMER_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
// Guest sessions are short-lived (12h) — see CustomerAuthService.guestSession.
const GUEST_TOKEN_MAX_AGE_SECONDS = 12 * 60 * 60

export async function setCustomerToken(token: string, isGuest = false): Promise<void> {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === "production"

  cookieStore.set(CUSTOMER_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: isGuest ? GUEST_TOKEN_MAX_AGE_SECONDS : CUSTOMER_TOKEN_MAX_AGE_SECONDS,
  })
}

export async function clearCustomerToken(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CUSTOMER_TOKEN_COOKIE)
}

export async function getCustomerToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(CUSTOMER_TOKEN_COOKIE)?.value
}

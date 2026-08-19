import "server-only"

import { cookies } from "next/headers"

export const CUSTOMER_TOKEN_COOKIE = "customer_access_token"

// Both the guest and signed-in-customer JWTs are now issued without an
// expiresIn (see CustomerAuthService) — a guest stays logged in for the
// lifetime of the session, ended only by explicit logout, never by a TTL. A
// browser cookie still needs a concrete maxAge to survive restarts though, so
// this is set as long as practical (10 years) rather than literally forever.
const CUSTOMER_TOKEN_MAX_AGE_SECONDS = 10 * 365 * 24 * 60 * 60

export async function setCustomerToken(token: string): Promise<void> {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === "production"

  cookieStore.set(CUSTOMER_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_TOKEN_MAX_AGE_SECONDS,
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

/**
 * Client-side backstop for the customer/guest session, in addition to the
 * httpOnly cookie the backend normally relies on. Some mobile browsers drop
 * or cap Set-Cookie'd sessions in ways that are outside this app's control
 * (ITP-style cookie jars, in-app webviews, etc.) — localStorage survives a
 * closed tab/app the same way the cookie is supposed to, and unlike the
 * cookie it's readable client-side, so a component can tell at a glance
 * whether a guest is "logged in" without a round trip. Cleared only by
 * explicit sign-out (useCustomerLogout) or the user clearing site data —
 * never by a TTL, matching the no-expiresIn JWT this token actually holds.
 */
const STORAGE_KEY = "rms_customer_token"

export function getStoredCustomerToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage disabled/unavailable (private mode in some browsers) — the
    // httpOnly cookie is still the fallback, so this just means no backstop.
    return null
  }
}

export function setStoredCustomerToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Ignore — see getStoredCustomerToken.
  }
}

export function clearStoredCustomerToken(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore — see getStoredCustomerToken.
  }
}

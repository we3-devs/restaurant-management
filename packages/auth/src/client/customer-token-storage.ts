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
const REFRESH_STORAGE_KEY = "rms_customer_refresh_token"

function read(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Storage disabled/unavailable (private mode in some browsers) — the
    // httpOnly cookies are still the fallback, so this just means no backstop.
    return null
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore — see read().
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore — see read().
  }
}

export function getStoredCustomerToken(): string | null {
  return read(STORAGE_KEY)
}

export function getStoredCustomerRefreshToken(): string | null {
  return read(REFRESH_STORAGE_KEY)
}

/** Stores the access token, and the refresh token too when the caller has it (sign-in / client-side rotation). */
export function setStoredCustomerToken(accessToken: string, refreshToken?: string): void {
  write(STORAGE_KEY, accessToken)
  if (refreshToken !== undefined) write(REFRESH_STORAGE_KEY, refreshToken)
}

export function clearStoredCustomerToken(): void {
  remove(STORAGE_KEY)
  remove(REFRESH_STORAGE_KEY)
}

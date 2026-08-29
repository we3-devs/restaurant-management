"use client";

/**
 * Customer session for the QR guest app.
 *
 * operational-web's /guest flow proxies OTP through its own Next route
 * handlers so the token can live in an httpOnly cookie. guest-web talks to the
 * backend directly (no route handlers), so the token is held here and attached
 * as a bearer header instead. localStorage — not sessionStorage — so a diner
 * stays signed in after closing the tab/app and scanning the table's QR code
 * again. The short-lived access token is renewed with the persisted refresh
 * token; the session only ends via explicit sign-out, refresh-token revocation,
 * or the browser clearing site data.
 */

const TOKEN_KEY = "guest_token";
const REFRESH_TOKEN_KEY = "guest_refresh_token";
const NAME_KEY = "guest_name";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getCustomerName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSession(token: string, refreshToken: string, name: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(NAME_KEY, name);
  notify();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  notify();
}

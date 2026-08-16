"use client";

/**
 * Customer session for the QR guest app.
 *
 * operational-web's /guest flow proxies OTP through its own Next route
 * handlers so the token can live in an httpOnly cookie. guest-web talks to the
 * backend directly (no route handlers), so the token is held here and attached
 * as a bearer header instead. sessionStorage — not localStorage — to match how
 * the table lock is scoped: a diner's session ends with the tab.
 */

const TOKEN_KEY = "guest_token";
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
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getCustomerName(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(NAME_KEY);
}

export function setSession(token: string, name: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(NAME_KEY, name);
  notify();
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(NAME_KEY);
  notify();
}

"use client";

import { clearSession, getToken } from "./guest-auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/** Unwraps the paginated {data,meta} envelope the public list endpoints use. */
export async function getJson(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  const json = await res.json();
  return json.data ?? json;
}

export async function authFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  // A 30-day customer token can still be revoked or invalidated server-side;
  // drop it so the UI falls back to the sign-in gate rather than looping on 401s.
  if (res.status === 401) clearSession();
  return res;
}

export async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  const message = body?.message;
  return Array.isArray(message) ? message.join(", ") : (message ?? fallback);
}

"use client";

import { clearSession, getRefreshToken, getToken, setSession } from "./guest-auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/** Unwraps the paginated {data,meta} envelope the public list endpoints use. */
export async function getJson(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  const json = await res.json();
  return json.data ?? json;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/customer-auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json();
        const name = localStorage.getItem("guest_name") ?? "Guest";
        if (!body.accessToken || !body.refreshToken) return null;
        setSession(body.accessToken, body.refreshToken, name);
        return body.accessToken as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function authFetch(path: string, init: RequestInit = {}) {
  const request = (token: string | null) => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, { ...init, headers });
  };

  const token = getToken();
  let res = await request(token);

  if (res.status === 401 && getRefreshToken()) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) res = await request(refreshedToken);
  }

  // A failed refresh or a rejected retry means the session is genuinely no
  // longer recoverable. Do not clear it on the first expired access-token 401.
  if (res.status === 401) clearSession();
  return res;
}

export async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  const message = body?.message;
  return Array.isArray(message) ? message.join(", ") : (message ?? fallback);
}

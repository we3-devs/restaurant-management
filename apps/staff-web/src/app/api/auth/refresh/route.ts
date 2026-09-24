import { NextRequest, NextResponse } from "next/server"
import { getRefreshToken, setAuthCookies } from "@/lib/auth/session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

/** Browser-side fallback used when an API request receives a 401. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null
  const refreshToken = body?.refreshToken ?? (await getRefreshToken())
  if (!refreshToken) return NextResponse.json({ message: "No refresh token" }, { status: 401 })

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    })
  } catch {
    // Network error reaching the backend (e.g. a cold-starting instance) —
    // the refresh token may still be perfectly valid, so this must not read
    // as "session expired" to the caller (apiClient forces a hard redirect
    // to /login on 401, which would log the user out over a transient blip).
    return NextResponse.json({ message: "Backend unreachable" }, { status: 503 })
  }
  if (!response.ok) {
    // Only a 401/403 from the backend means the refresh token itself was
    // rejected (expired/reused/revoked) — anything else is transient.
    const status = response.status === 401 || response.status === 403 ? 401 : 503
    return NextResponse.json({ message: "Session expired" }, { status })
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string }
  await setAuthCookies({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/auth/session"

/**
 * GET so `redirect()` from a Server Component (the DAL's verifySession) can
 * target it directly. Route Handlers can mutate cookies where Server
 * Components can't — see clearAuthCookies()'s doc comment — so this is what
 * actually clears the stale access/refresh cookies before landing on
 * /login. Without this hop, an expired refresh token left proxy.ts seeing a
 * cookie that was never cleared, which kept bouncing /login back to
 * /dashboard (ERR_TOO_MANY_REDIRECTS).
 */
export async function GET(request: Request) {
  await clearAuthCookies()
  return NextResponse.redirect(new URL("/login", request.url))
}

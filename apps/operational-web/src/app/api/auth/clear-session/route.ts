import { NextResponse } from "next/server"
import { clearAuthCookies } from "@rms/auth/session"

/**
 * GET so `redirect()` from a Server Component (the DAL's verifySession) can
 * target it directly. Route Handlers can mutate cookies where Server
 * Components can't — see clearAuthCookies()'s doc comment — so this is what
 * actually clears the stale access/refresh cookies before landing on
 * /login. Without this route, verifySession's redirect target 404s
 * ("page not found") whenever the session can't be refreshed.
 */
export async function GET(request: Request) {
  await clearAuthCookies()
  return NextResponse.redirect(new URL("/login", request.url))
}

import { NextRequest, NextResponse } from "next/server"
import { ACCESS_TOKEN_COOKIE } from "@rms/auth/session"

// Routes that must be reachable without a (staff) session: the login page
// and the whole /guest subtree — the QR ordering/tracking flow guests use
// has its own, separate customer-JWT auth (see customer-session.ts) and
// never carries a staff cookie.
const AUTH_ROUTES = ["/login", "/guest"]

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

/**
 * Optimistic-only check (cookie presence, no backend call — Proxy must stay
 * fast, per Next's docs). The real check is verifySession() in the DAL,
 * called from the route group layouts.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value)
  const { pathname } = request.nextUrl
  const isAuth = isAuthRoute(pathname)

  if (!hasSession && !isAuth) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (hasSession && isAuth) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

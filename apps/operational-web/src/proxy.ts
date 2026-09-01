import { NextRequest, NextResponse } from "next/server"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@rms/auth/session"

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
  // Access token cookie is short-lived (15min) and expires long before the
  // refresh token; checking only the access token would bounce an idle user
  // to /login even though their session is silently renewable in the DAL.
  const hasSession = Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? request.cookies.get(REFRESH_TOKEN_COOKIE)?.value,
  )
  const { pathname } = request.nextUrl
  const isAuth = isAuthRoute(pathname)

  // Credential query parameters are never valid login state. Strip them at
  // the edge so they cannot persist in the address bar or be rendered into a
  // page after a native/old login form submission.
  if (isAuth && (request.nextUrl.searchParams.has("email") || request.nextUrl.searchParams.has("password"))) {
    const cleanUrl = new URL(request.url)
    cleanUrl.search = ""
    return NextResponse.redirect(cleanUrl)
  }

  if (!hasSession && !isAuth) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Keep /login reachable when a stale or revoked cookie is present. The
  // presence check above cannot validate the token, and redirecting here can
  // create an endless /login -> / -> /clear-session -> /login loop.
  if (hasSession && isAuth && pathname !== "/login") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

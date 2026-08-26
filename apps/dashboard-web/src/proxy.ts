import { NextRequest, NextResponse } from "next/server"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/session"

// Routes that must be reachable without a (staff) session. /guest (QR
// ordering, its own customer-JWT auth) moved to operational-web along with
// the rest of the customer-facing flows, so only /login remains here.
const AUTH_ROUTES = ["/login"]

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

/**
 * Optimistic-only check (cookie presence, no backend call — Proxy must stay
 * fast, per Next's docs). The real check is verifySession() in the DAL,
 * called from (dashboard)/layout.tsx.
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

  if (!hasSession && !isAuth) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // "/" itself renders app/page.tsx, which does the real (backend-verified)
  // permission check and sends admins/superadmins to /dashboard, everyone
  // else to /staff — proxy can't make that call itself, it only knows a
  // cookie is present.
  if (hasSession && isAuth) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Forward the pathname to server components (layout.tsx route guards read
  // it via headers()) since there's no other reliable way to get it there.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

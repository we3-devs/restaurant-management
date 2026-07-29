import { NextRequest, NextResponse } from "next/server"
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/session"

const AUTH_ROUTES = ["/login"]

/**
 * Optimistic-only check (cookie presence, no backend call — Proxy must stay
 * fast, per Next's docs). The real check is verifySession() in the DAL,
 * called from (dashboard)/layout.tsx.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value)
  const { pathname } = request.nextUrl
  const isAuthRoute = AUTH_ROUTES.includes(pathname)

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", request.url))
  }

  if (!hasSession && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

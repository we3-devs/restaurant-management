import { NextRequest, NextResponse } from "next/server"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  authCookieAttributes,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from "@/lib/auth/session"
import { isAllowedTenantHost, tenantHeaders } from "@rms/auth/tenant"

// Routes that must be reachable without a (staff) session. /guest (QR
// ordering, its own customer-JWT auth) moved to operational-web along with
// the rest of the customer-facing flows, so only /login remains here.
const AUTH_ROUTES = ["/login"]

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

/** Decodes a JWT's exp claim without verifying the signature — only used to decide whether a proactive refresh is worth attempting; the backend is the real authority. */
function accessTokenExpiresAt(token: string): number | null {
  const payload = token.split(".")[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    const { exp } = JSON.parse(json) as { exp?: number }
    return typeof exp === "number" ? exp * 1000 : null
  } catch {
    return null
  }
}

interface RefreshedTokens {
  accessToken: string
  refreshToken: string
}

// Dedupes concurrent refreshes for the same refresh token within this server
// instance. The backend rotates refresh tokens on every use and revokes the
// whole chain on reuse (theft detection) — without this, a page navigation's
// parallel RSC/prefetch requests would each try to redeem the same token and
// the loser would get its session killed instead of just refreshed.
//
// Keyed by token (a Map, not a single slot): this instance serves every
// logged-in staff member concurrently, and a single-slot version would get
// clobbered the moment a second user's refresh landed mid-flight — a third
// request for the first user would then no longer find its own entry, fire a
// second concurrent redemption of the same already-in-flight token, and trip
// the same reuse-detection that kills the whole session chain. That's the
// randomly-timed session death this map exists to prevent.
const refreshInFlight = new Map<string, Promise<RefreshedTokens | null>>()

async function refreshTokens(refreshToken: string): Promise<RefreshedTokens | null> {
  const existing = refreshInFlight.get(refreshToken)
  if (existing) return existing
  const promise = fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })
    .then((response) => (response.ok ? (response.json() as Promise<RefreshedTokens>) : null))
    .catch(() => null)
    .finally(() => {
      refreshInFlight.delete(refreshToken)
    })
  refreshInFlight.set(refreshToken, promise)
  return promise
}

/**
 * Optimistic-only check (cookie presence, no backend call — Proxy must stay
 * fast, per Next's docs). The real check is verifySession() in the DAL,
 * called from (dashboard)/layout.tsx.
 */
export async function proxy(request: NextRequest) {
  if (!isAllowedTenantHost(request.headers.get("host"), "staff")) {
    return new NextResponse("Unknown tenant host", { status: 421, headers: { "Cache-Control": "no-store" } })
  }
  // PWA assets must be fetched before authentication redirects. In particular,
  // redirecting /sw.js to /login makes service-worker registration fail because
  // the browser receives HTML instead of JavaScript.
  const { pathname } = request.nextUrl
  if (pathname === "/sw.js" || pathname === "/manifest.json" || pathname === "/favicon.ico" || pathname.startsWith("/icons/")) {
    return NextResponse.next({ request: { headers: tenantHeaders(request) } })
  }
  // Access token cookie is short-lived (15min) and expires long before the
  // refresh token; checking only the access token would bounce an idle user
  // to /login even though their session is silently renewable in the DAL.
  const hasSession = Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? request.cookies.get(REFRESH_TOKEN_COOKIE)?.value,
  )
  // API proxy routes still need tenant context, but authentication is handled
  // by the backend/session wrapper instead of an edge redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers: tenantHeaders(request) } })
  }
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

  // "/" itself renders app/page.tsx, which does the real (backend-verified)
  // permission check and sends admins to /dashboard, everyone else to
  // /staff — proxy can't make that call itself, it only knows a cookie is
  // present.
  // Do not bounce /login merely because a cookie exists. The cookie may be
  // expired, revoked, or left over from a different cookie domain; the real
  // session check happens in the protected layout and must be recoverable.
  if (hasSession && isAuth && pathname !== "/login") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Proactively refresh the access token here, before any Server Component
  // renders. Server Components can only READ cookies — the DAL's own
  // refresh-on-401 fallback (session-fetch.ts) cannot persist a renewed
  // token when it fires mid-render, so an idle tab's access token cookie
  // just kept going stale forever and the session silently died a couple of
  // navigations later when the (already-rotated) refresh token was reused.
  // Middleware is the one place that can both read the incoming request's
  // cookies and reliably write Set-Cookie for the response, so it's the
  // right place to keep this cookie alive.
  let refreshedTokens: RefreshedTokens | null = null
  if (hasSession && !isAuth) {
    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
    const expiresAt = accessToken ? accessTokenExpiresAt(accessToken) : null
    const needsRefresh = Boolean(refreshToken) && (!accessToken || expiresAt === null || expiresAt < Date.now() + 10_000)
    if (needsRefresh && refreshToken) {
      refreshedTokens = await refreshTokens(refreshToken)
      if (refreshedTokens) {
        // Forward the new cookie to this request too, so the Server
        // Components rendered right after this middleware see a valid
        // access token instead of the stale one that triggered the refresh.
        request.cookies.set(ACCESS_TOKEN_COOKIE, refreshedTokens.accessToken)
        request.cookies.set(REFRESH_TOKEN_COOKIE, refreshedTokens.refreshToken)
      }
    }
  }

  // Forward the pathname to server components (layout.tsx route guards read
  // it via headers()) since there's no other reliable way to get it there.
  const requestHeaders = tenantHeaders(request)
  requestHeaders.set("x-pathname", pathname)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (refreshedTokens) {
    response.cookies.set(ACCESS_TOKEN_COOKIE, refreshedTokens.accessToken, authCookieAttributes(ACCESS_TOKEN_MAX_AGE_SECONDS))
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshedTokens.refreshToken, authCookieAttributes(REFRESH_TOKEN_MAX_AGE_SECONDS))
  }
  return response
}

export const config = {
  // _next/webpack-hmr must stay excluded too: it's a WebSocket upgrade
  // request, and this proxy redirecting it to /login (as it would any other
  // unauthenticated non-API path) returns a redirect instead of a 101
  // response. In dev, Next's client bootstrap calls hydrate() from inside
  // its HMR-socket setup, so that failed upgrade throws before hydrateRoot()
  // ever runs — the page never becomes interactive (forms silently fall
  // back to native submission) even though it looks fully rendered.
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)"],
}

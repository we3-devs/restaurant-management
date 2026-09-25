import { NextRequest, NextResponse } from "next/server"
import { isAllowedTenantHost, tenantHeaders } from "@rms/auth/tenant"

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https:",
].join("; ")

export function proxy(request: NextRequest) {
  if (!isAllowedTenantHost(request.headers.get("host"), "guest")) {
    return new NextResponse("Unknown tenant host", { status: 421, headers: { "Cache-Control": "no-store" } })
  }
  const headers = tenantHeaders(request)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY)
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  // geolocation=(self): quick-order outlets geofence-check the guest at
  // checkout (see menu-content.tsx placeOrder / use-quick-order-session.ts).
  // A blanket geolocation=() blocks getCurrentPosition() at the browser
  // level before the OS permission prompt can ever appear — no toggle in the
  // browser's own site settings can undo that once it's in the page's own
  // response headers.
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

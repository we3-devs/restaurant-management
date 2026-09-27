import { NextRequest, NextResponse } from "next/server"
import { backendUrl } from "@rms/auth/config"
import { clearAuthCookies, getRefreshToken, setAuthCookies } from "@/lib/auth/session"


type AuthTokens = { accessToken: string; refreshToken: string }

/**
 * "invalid" only when the backend definitively rejected the refresh token
 * (401/403: expired/reused/revoked). A network error reaching the backend
 * (e.g. a cold-starting instance) or a 5xx is "transient" — the refresh
 * token may still be perfectly valid, so it must never read as "session
 * expired" to the caller.
 */
type RefreshOutcome = { status: "ok"; tokens: AuthTokens } | { status: "invalid" } | { status: "transient" }

async function redeem(refreshToken: string | undefined): Promise<RefreshOutcome> {
  if (!refreshToken) {
    console.warn("[auth] refresh route: no refresh_token cookie on the request")
    return { status: "invalid" }
  }
  let response: Response
  try {
    response = await fetch(`${backendUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    })
  } catch (error) {
    console.warn(`[auth] refresh route: backend unreachable: ${error instanceof Error ? error.message : String(error)}`)
    return { status: "transient" }
  }
  if (!response.ok) {
    // The backend's message says which rejection it was (expired, reused,
    // revoked…) — no token material, safe to log.
    console.warn(`[auth] refresh route: backend returned ${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`)
    return response.status === 401 || response.status === 403 ? { status: "invalid" } : { status: "transient" }
  }
  return { status: "ok", tokens: (await response.json()) as AuthTokens }
}

/** Browser-side fallback used when an API request receives a 401. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null
  const outcome = await redeem(body?.refreshToken ?? (await getRefreshToken()))
  if (outcome.status === "invalid") return NextResponse.json({ message: "Session expired" }, { status: 401 })
  // apiClient forces a hard redirect to /login on 401, so a transient
  // failure must be a 503 or the user gets logged out over a blip.
  if (outcome.status === "transient") return NextResponse.json({ message: "Backend unreachable" }, { status: 503 })

  await setAuthCookies(outcome.tokens)
  return NextResponse.json({ ok: true })
}

/**
 * Only same-origin page paths — never another origin, and never back into
 * /api (which could loop). Compares the resolved origin rather than string
 * prefixes: the URL parser drops tabs/newlines and treats "\\" like "/", so
 * e.g. "/%09/evil.com" passes a prefix check yet resolves off-site.
 */
function safeReturnPath(value: string | null, base: string): string {
  const fallback = new URL("/", base)
  if (!value?.startsWith("/")) return "/"
  let url: URL
  try {
    url = new URL(value, fallback)
  } catch {
    return "/"
  }
  if (url.origin !== fallback.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) return "/"
  return `${url.pathname}${url.search}`
}

/** /login tagged with why the session ended, so an unexpected logout explains itself. */
function loginWithReason(request: NextRequest, reason: string): URL {
  const url = new URL("/login", request.url)
  url.searchParams.set("reason", reason)
  return url
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Page-render detour. verifySession() redirects here when the backend
 * rejects the access token mid-render, because a Server Component can't
 * persist a refreshed token itself (see dal.ts). This handler can: it
 * refreshes, confirms the new access token is accepted, and sends the
 * browser back to the page it was on.
 */
export async function GET(request: NextRequest) {
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"), request.url)
  const outcome = await redeem(await getRefreshToken())

  if (outcome.status === "ok") {
    await setAuthCookies(outcome.tokens)
    // Check the fresh token before bouncing back, so a token the backend
    // still won't accept ends here instead of looping page -> refresh -> page.
    const me = await fetch(`${backendUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${outcome.tokens.accessToken}` },
      cache: "no-store",
    }).catch(() => null)
    if (me?.ok) return NextResponse.redirect(new URL(next, request.url))
    if (me && (me.status === 401 || me.status === 403)) {
      console.warn(`[auth] refresh detour: fresh token rejected by /auth/me: ${me.status} ${(await me.text().catch(() => "")).slice(0, 200)}`)
      await clearAuthCookies()
      return NextResponse.redirect(loginWithReason(request, "me_rejected"))
    }
  } else if (outcome.status === "invalid") {
    await clearAuthCookies()
    return NextResponse.redirect(loginWithReason(request, "refresh_rejected"))
  }

  // Backend unreachable: keep the session and retry shortly — this is what
  // a cold-starting backend looks like, not a logout.
  const href = escapeHtml(next)
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="5;url=${href}"><title>Reconnecting…</title></head>` +
      `<body style="font-family:system-ui,sans-serif;padding:2rem">` +
      `<p>Can't reach the server right now. Retrying in a few seconds…</p><p><a href="${href}">Retry now</a></p></body></html>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "5" } },
  )
}

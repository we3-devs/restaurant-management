/**
 * Deployment settings the apps can't run without. There are deliberately no
 * fallback URLs: a missing value is reported — each app's proxy.ts answers
 * every page and API request with an error naming it — instead of quietly
 * sending traffic to some other deployment.
 */

/** The NestJS backend origin for server-side calls (BACKEND_INTERNAL_URL), without a trailing slash. */
export function backendUrl(): string {
  return requireUrl("BACKEND_INTERNAL_URL", process.env.BACKEND_INTERNAL_URL)
}

/** The backend's public API base (NEXT_PUBLIC_API_URL, which already ends in /api), without a trailing slash. */
export function publicApiUrl(): string {
  return requireUrl("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
}

function requireUrl(name: string, value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new Error(`${name} is not set`)
  return trimmed.replace(/\/+$/, "")
}

/**
 * Names of the given settings that are unset or blank. Takes the values, not
 * just names, so callers read NEXT_PUBLIC_* variables literally — Next.js
 * only inlines those into the build when accessed as process.env.NAME.
 */
export function missingSettings(settings: Record<string, string | undefined>): string[] {
  return Object.entries(settings)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name)
}

/** What proxy.ts returns while settings are missing: JSON for API calls, a plain page for everything else. */
export function misconfiguredResponse(pathname: string, missing: string[]): Response {
  const message = `This app is not configured: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set.`
  const headers = { "Cache-Control": "no-store" }
  if (pathname.startsWith("/api/")) {
    return Response.json({ message }, { status: 500, headers })
  }
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Configuration error</title></head>` +
      `<body style="font-family:system-ui,sans-serif;padding:2rem"><h1>Configuration error</h1><p>${message}</p></body></html>`,
    { status: 500, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } },
  )
}

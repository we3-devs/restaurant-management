import { NextRequest, NextResponse } from "next/server"
import { setAuthCookies } from "@/lib/auth/session"
import { loginSchema } from "@/lib/validators/auth"
import { tenantHeaders } from "@rms/auth/tenant"

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid email or password format" },
      { status: 400 },
    )
  }

  try {
    // Bind login to the verified staff hostname. Middleware normally adds
    // this header, but route handlers must not depend on that rewrite being
    // visible in every deployed Next runtime.
    const tenantSlug = tenantHeaders(request).get("x-tenant-slug")

    const backendResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}),
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    })

    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => null)

      return NextResponse.json(
        { message: error?.message ?? "Invalid credentials" },
        { status: backendResponse.status },
      )
    }

    const data = await backendResponse.json()

    await setAuthCookies({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    })

    // Never forward raw tokens to the browser.
    return NextResponse.json({ user: data.user })
  } catch {
    return NextResponse.json(
      { message: "Authentication service is temporarily unavailable" },
      { status: 503 },
    )
  }
}

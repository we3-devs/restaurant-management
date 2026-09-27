import { NextRequest, NextResponse } from "next/server"
import { backendUrl } from "@rms/auth/config"
import { setAuthCookies } from "@/lib/auth/session"
import { loginSchema } from "@/lib/validators/auth"
import { tenantHeaders } from "@rms/auth/tenant"


type AuthenticatedUser = {
  id: number
  name: string
  email: string
  tenantId: number | null
  portal: "dashboard" | "staff"
  hasBothPortals: boolean
  outletIds: number[]
}

type BackendLoginResponse = {
  accessToken: string
  refreshToken: string
  user: AuthenticatedUser
}

function isBackendLoginResponse(value: unknown): value is BackendLoginResponse {
  if (!value || typeof value !== "object") return false
  const response = value as Partial<BackendLoginResponse>
  const user = response.user
  return typeof response.accessToken === "string" && response.accessToken.length > 0
    && typeof response.refreshToken === "string" && response.refreshToken.length > 0
    && !!user
    && typeof user.id === "number"
    && typeof user.name === "string"
    && typeof user.email === "string"
    && (typeof user.tenantId === "number" || user.tenantId === null)
    && (user.portal === "dashboard" || user.portal === "staff")
    && typeof user.hasBothPortals === "boolean"
    && Array.isArray(user.outletIds)
}

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

    const backendResponse = await fetch(`${backendUrl()}/api/auth/login`, {
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

    const data: unknown = await backendResponse.json().catch(() => null)
    if (!isBackendLoginResponse(data)) {
      return NextResponse.json(
        { message: "Authentication service returned an invalid session" },
        { status: 502 },
      )
    }

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

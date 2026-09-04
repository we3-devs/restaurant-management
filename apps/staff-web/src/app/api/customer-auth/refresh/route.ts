import { NextRequest, NextResponse } from "next/server"
import { clearCustomerSession, getCustomerRefreshToken, setCustomerSession } from "@rms/auth/customer-session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

/**
 * Client-driven refresh — used by customerApiClient's localStorage backstop
 * path (see customer-client.ts) when a mobile browser dropped the httpOnly
 * cookies. The server-rendered paths refresh themselves inside
 * customerBackendFetch and never hit this route. Takes the refresh token from
 * the request body, falling back to the cookie.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null
  const refreshToken = body?.refreshToken || (await getCustomerRefreshToken())

  if (!refreshToken) {
    return NextResponse.json({ message: "No refresh token" }, { status: 401 })
  }

  const backendResponse = await fetch(`${BACKEND_URL}/api/customer-auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })

  if (!backendResponse.ok) {
    await clearCustomerSession()
    return NextResponse.json({ message: "Session expired" }, { status: 401 })
  }

  const data = (await backendResponse.json()) as { accessToken: string; refreshToken: string }
  await setCustomerSession(data)
  return NextResponse.json(data)
}

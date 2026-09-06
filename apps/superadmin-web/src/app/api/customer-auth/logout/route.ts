import { NextRequest, NextResponse } from "next/server"
import { clearCustomerSession, getCustomerRefreshToken } from "@rms/auth/customer-session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null
  const refreshToken = (await getCustomerRefreshToken()) || body?.refreshToken

  if (refreshToken) {
    // Best-effort revoke server-side so the refresh token can't be replayed.
    await fetch(`${BACKEND_URL}/api/customer-auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => null)
  }

  await clearCustomerSession()
  return NextResponse.json({ ok: true })
}

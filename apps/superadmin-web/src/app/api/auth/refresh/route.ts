import { NextRequest, NextResponse } from "next/server"
import { getRefreshToken, setAuthCookies } from "@/lib/auth/session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

/** Browser-side fallback used when an API request receives a 401. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null
  const refreshToken = body?.refreshToken ?? (await getRefreshToken())
  if (!refreshToken) return NextResponse.json({ message: "No refresh token" }, { status: 401 })

  const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })
  if (!response.ok) return NextResponse.json({ message: "Session expired" }, { status: 401 })

  const data = (await response.json()) as { accessToken: string; refreshToken: string }
  await setAuthCookies({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return NextResponse.json({ ok: true })
}

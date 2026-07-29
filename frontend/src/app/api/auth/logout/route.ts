import { NextResponse } from "next/server"
import { clearAuthCookies, getRefreshToken } from "@/lib/auth/session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001"

export async function POST() {
  const refreshToken = await getRefreshToken()

  if (refreshToken) {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => null)
  }

  await clearAuthCookies()
  return NextResponse.json({ ok: true })
}

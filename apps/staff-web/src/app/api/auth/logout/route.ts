import { NextResponse } from "next/server"
import { backendUrl } from "@rms/auth/config"
import { clearAuthCookies, getRefreshToken } from "@/lib/auth/session"


export async function POST() {
  const refreshToken = await getRefreshToken()

  if (refreshToken) {
    await fetch(`${backendUrl()}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => null)
  }

  await clearAuthCookies()
  return NextResponse.json({ ok: true })
}

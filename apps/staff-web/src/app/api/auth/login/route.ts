import { NextRequest, NextResponse } from "next/server"
import { setAuthCookies } from "@/lib/auth/session"
import { loginSchema } from "@/lib/validators/auth"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid email or password format" }, { status: 400 })
  }

  const backendResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  await setAuthCookies({ accessToken: data.accessToken, refreshToken: data.refreshToken })

  // Never forward the raw tokens to the browser — only the user profile.
  return NextResponse.json({ user: data.user })
}

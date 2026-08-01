import { NextRequest, NextResponse } from "next/server"
import { setCustomerToken } from "@/lib/auth/customer-session"
import { verifyOtpSchema } from "@/lib/validators/customer-portal"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = verifyOtpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid code" }, { status: 400 })
  }

  const backendResponse = await fetch(`${BACKEND_URL}/api/customer-auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  })

  if (!backendResponse.ok) {
    const error = await backendResponse.json().catch(() => null)
    return NextResponse.json({ message: error?.message ?? "Invalid or expired code" }, { status: backendResponse.status })
  }

  const data = (await backendResponse.json()) as { accessToken: string; customer: { id: number; name: string } }
  await setCustomerToken(data.accessToken)

  return NextResponse.json({ customer: data.customer })
}

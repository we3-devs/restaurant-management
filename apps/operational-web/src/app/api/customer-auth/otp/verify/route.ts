import { NextRequest, NextResponse } from "next/server"
import { setCustomerToken } from "@rms/auth/customer-session"
import { verifyOtpSchema } from "@rms/validators/customer-portal"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

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

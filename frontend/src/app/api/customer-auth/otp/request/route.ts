import { NextRequest, NextResponse } from "next/server"
import { requestOtpSchema } from "@/lib/validators/customer-portal"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://https://restaurant-management-g6vb.onrender.com"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = requestOtpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: "Provide a phone number or email" }, { status: 400 })
  }

  const backendResponse = await fetch(`${BACKEND_URL}/api/customer-auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  })

  const data = await backendResponse.json().catch(() => null)
  return NextResponse.json(data, { status: backendResponse.status })
}

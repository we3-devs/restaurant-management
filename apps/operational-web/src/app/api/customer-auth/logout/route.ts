import { NextResponse } from "next/server"
import { clearCustomerToken } from "@rms/auth/customer-session"

export async function POST() {
  await clearCustomerToken()
  return NextResponse.json({ ok: true })
}

import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { customerBackendFetch, CustomerUnauthorizedError } from "@/lib/server/customer-backend-client"

export interface CurrentCustomer {
  sub: number | null
  type: "customer" | "guest"
  phone?: string
  email?: string
  tableId?: number
}

/** Redirects to /portal/login if there's no valid signed-in customer session (guests are not enough). */
export const verifyCustomerSession = cache(async (): Promise<CurrentCustomer> => {
  const customer = await getCurrentCustomer()
  if (!customer || customer.type !== "customer") {
    redirect("/portal/login")
  }
  return customer
})

/** Non-redirecting variant for pages (like /guest) that show an inline auth gate instead of bouncing to /portal/login. Returns null if there's no valid session of either type. */
export const getCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  try {
    const response = await customerBackendFetch("/customer-auth/me")
    if (!response.ok) return null
    return (await response.json()) as CurrentCustomer
  } catch (error) {
    if (error instanceof CustomerUnauthorizedError) return null
    throw error
  }
})

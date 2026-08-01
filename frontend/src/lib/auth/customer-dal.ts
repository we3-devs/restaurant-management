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
  try {
    const response = await customerBackendFetch("/customer-auth/me")
    if (!response.ok) {
      redirect("/portal/login")
    }
    const customer = (await response.json()) as CurrentCustomer
    if (customer.type !== "customer") {
      redirect("/portal/login")
    }
    return customer
  } catch (error) {
    if (error instanceof CustomerUnauthorizedError) {
      redirect("/portal/login")
    }
    throw error
  }
})

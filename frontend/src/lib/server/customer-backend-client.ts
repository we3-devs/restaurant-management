import "server-only"

import { getCustomerToken } from "@/lib/auth/customer-session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://https://restaurant-management-g6vb.onrender.com"

export class CustomerUnauthorizedError extends Error {
  constructor() {
    super("Customer session expired or invalid")
    this.name = "CustomerUnauthorizedError"
  }
}

/**
 * Server-only fetch wrapper for the customer portal / QR-ordering endpoints.
 * Unlike backend-client.ts (staff), there is no refresh-token rotation here —
 * a 30-day customer JWT or a 12h guest JWT is reissued via sign-in/guest
 * session instead. See CustomerAuthModule on the backend.
 */
export async function customerBackendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getCustomerToken()
  const headers = new Headers(init.headers)
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${BACKEND_URL}/api${path}`, { ...init, headers, cache: "no-store" })

  if (response.status === 401) {
    throw new CustomerUnauthorizedError()
  }

  return response
}

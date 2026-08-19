import "server-only"

import { getCustomerToken } from "../customer-session"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "https://restaurant-management-g6vb.onrender.com"

export class CustomerUnauthorizedError extends Error {
  constructor() {
    super("Customer session expired or invalid")
    this.name = "CustomerUnauthorizedError"
  }
}

/**
 * Server-only fetch wrapper for the customer portal / QR-ordering endpoints.
 * Both the customer and guest JWTs are non-expiring (see CustomerAuthService)
 * — a session only ends via explicit sign-out.
 */
export async function customerBackendFetch(
  path: string,
  init: RequestInit = {},
  // Lets a caller (the /api/customer-backend proxy) pass through a token the
  // client sent explicitly — e.g. from its localStorage backstop, see
  // client/customer-token-storage.ts — instead of only ever trusting the
  // httpOnly cookie, which is what a guest whose cookie never persisted
  // wouldn't have.
  tokenOverride?: string,
): Promise<Response> {
  const token = tokenOverride ?? (await getCustomerToken())
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

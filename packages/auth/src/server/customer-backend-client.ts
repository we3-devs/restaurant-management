import "server-only"

import {
  clearCustomerSession,
  getCustomerRefreshToken,
  getCustomerToken,
  setCustomerSession,
} from "../customer-session"
import { sessionFetch } from "./session-fetch"

// NEXT_PUBLIC_API_URL already includes a trailing /api (see layout.tsx,
// guest-socket.ts), which sessionFetch appends itself, so it's stripped here.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ?? ""

export class CustomerUnauthorizedError extends Error {
  constructor() {
    super("Customer session expired or invalid")
    this.name = "CustomerUnauthorizedError"
  }
}

/**
 * Rotates the refresh cookie for a new pair. Returns the new access token, or
 * null when there's nothing to refresh with / the refresh itself failed.
 * Writing the cookies is best-effort (see setCustomerSession) — the caller
 * still gets a usable token back for the current request regardless.
 */
/**
 * Server-only fetch wrapper for the customer portal / QR-ordering endpoints.
 * Attaches the customer/guest access token from cookies and, on a 401, tries
 * exactly one refresh + retry before giving up — mirroring backendFetch for
 * staff.
 */
export async function customerBackendFetch(
  path: string,
  init: RequestInit = {},
  // Lets the /api/customer-backend proxy pass through a token the client sent
  // explicitly (from its localStorage backstop — see
  // client/customer-token-storage.ts). When this is set the client owns the
  // refresh cycle, so a 401 here is terminal rather than server-refreshed.
  tokenOverride?: string,
): Promise<Response> {
  return sessionFetch(
    {
      backendUrl: BACKEND_URL,
      refreshPath: "/customer-auth/refresh",
      getAccessToken: getCustomerToken,
      getRefreshToken: getCustomerRefreshToken,
      setTokens: setCustomerSession,
      clearSession: clearCustomerSession,
      unauthorizedError: new CustomerUnauthorizedError(),
      scope: "customer",
    },
    path,
    init,
    tokenOverride,
  )
}

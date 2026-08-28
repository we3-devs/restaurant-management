import { useMutation } from "@tanstack/react-query"
import {
  clearStoredCustomerToken,
  getStoredCustomerRefreshToken,
  setStoredCustomerToken,
} from "@rms/auth/client/customer-token-storage"
import type { RequestOtpInput, VerifyOtpInput } from "@rms/validators/customer-portal"

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed")
  }
  return data as T
}

export function useRequestOtp() {
  return useMutation({
    // devCode is TEMPORARY — always populated, including production (see
    // CustomerAuthService.requestOtp) — remove once real SMS delivery is
    // confirmed working end-to-end.
    mutationFn: (input: RequestOtpInput) =>
      post<{ sent: true; devCode?: string }>("/api/customer-auth/otp/request", input),
  })
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async (input: VerifyOtpInput) => {
      const result = await post<{
        customer: { id: number; name: string }
        accessToken: string
        refreshToken: string
      }>("/api/customer-auth/otp/verify", input)
      // Backstop copy — see customer-token-storage.ts. The httpOnly cookies
      // set server-side are the normal path; this is what lets the session
      // survive a browser/cookie jar that drops them, including silent
      // refresh (the client rotates the stored refresh token itself).
      setStoredCustomerToken(result.accessToken, result.refreshToken)
      return result
    },
  })
}

export function useCustomerLogout() {
  return useMutation({
    mutationFn: async () => {
      // Pass the backstop refresh token so the server can revoke it even when
      // the httpOnly cookie never made it to this browser.
      const result = await post<{ ok: true }>("/api/customer-auth/logout", {
        refreshToken: getStoredCustomerRefreshToken() ?? undefined,
      })
      clearStoredCustomerToken()
      return result
    },
  })
}

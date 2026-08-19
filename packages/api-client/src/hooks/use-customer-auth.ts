import { useMutation } from "@tanstack/react-query"
import {
  clearStoredCustomerToken,
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
      const result = await post<{ customer: { id: number; name: string }; accessToken: string }>(
        "/api/customer-auth/otp/verify",
        input,
      )
      // Backstop copy — see customer-token-storage.ts. The httpOnly cookie
      // set server-side is the normal path; this is what lets the guest
      // session survive a browser/cookie jar that drops it.
      setStoredCustomerToken(result.accessToken)
      return result
    },
  })
}

export function useCustomerLogout() {
  return useMutation({
    mutationFn: async () => {
      const result = await post<{ ok: true }>("/api/customer-auth/logout", {})
      clearStoredCustomerToken()
      return result
    },
  })
}

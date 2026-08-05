import { useMutation } from "@tanstack/react-query"
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
    mutationFn: (input: VerifyOtpInput) =>
      post<{ customer: { id: number; name: string } }>("/api/customer-auth/otp/verify", input),
  })
}

export function useCustomerLogout() {
  return useMutation({
    mutationFn: () => post<{ ok: true }>("/api/customer-auth/logout", {}),
  })
}

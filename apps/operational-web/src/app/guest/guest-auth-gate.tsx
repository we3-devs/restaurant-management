"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { useRequestOtp, useVerifyOtp } from "@rms/api-client/hooks/use-customer-auth"

/**
 * Inline phone+OTP verification embedded in /guest (not a redirect to
 * /portal/login — a guest shouldn't leave their table-ordering flow to sign
 * in). This is the actual anti-abuse mechanism for ordering: the static QR
 * printed on the table never changes, so anyone who's seen the link could
 * hit /guest from anywhere — a verified phone number is what ties an order
 * to a real, contactable person instead of an anonymous static URL.
 */
export function GuestAuthGate() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [stage, setStage] = useState<"identify" | "verify">("identify")
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  const requestOtp = useRequestOtp()
  const verifyOtp = useVerifyOtp()

  async function handleRequestOtp() {
    setError(null)
    try {
      const result = await requestOtp.mutateAsync({ phone })
      setDevCode(result.devCode ?? null)
      setStage("verify")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code")
    }
  }

  async function handleVerifyOtp() {
    setError(null)
    try {
      await verifyOtp.mutateAsync({ phone, code, name: name || undefined })
      // Re-runs the server component so it picks up the now-set customer
      // cookie and passes a real `initialCustomer` down — see guest/page.tsx.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code")
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-muted-foreground">
        {stage === "identify"
          ? "Verify your phone number to order — this keeps ordering tied to a real person, not just this link."
          : `Enter the 6-digit code sent to ${phone}`}
      </p>
      {stage === "identify" ? (
        <>
          <Input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={!phone || requestOtp.isPending} onClick={handleRequestOtp}>
            {requestOtp.isPending ? "Sending..." : "Send code"}
          </Button>
        </>
      ) : (
        <>
          {/* TEMPORARY: code echoed by the API in every environment, including
              production (no SMS delivery confirmed working yet) — remove
              this block once that's verified end-to-end. */}
          {devCode && (
            <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              Dev mode — your code is <span className="font-mono font-semibold">{devCode}</span>
            </p>
          )}
          <Input
            placeholder="6-digit code"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input
            placeholder="Your name (first time only)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={code.length !== 6 || verifyOtp.isPending} onClick={handleVerifyOtp}>
            {verifyOtp.isPending ? "Verifying..." : "Verify & continue"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStage("identify")}>
            Use a different number
          </Button>
        </>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useRequestOtp, useVerifyOtp } from "@/hooks/use-customer-auth"

export default function CustomerLoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [stage, setStage] = useState<"identify" | "verify">("identify")
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  const requestOtp = useRequestOtp()
  const verifyOtp = useVerifyOtp()

  const isEmail = identifier.includes("@")

  async function handleRequestOtp() {
    setError(null)
    try {
      const result = await requestOtp.mutateAsync(isEmail ? { email: identifier } : { phone: identifier })
      setDevCode(result.devCode ?? null)
      setStage("verify")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code")
    }
  }

  async function handleVerifyOtp() {
    setError(null)
    try {
      await verifyOtp.mutateAsync({
        ...(isEmail ? { email: identifier } : { phone: identifier }),
        code,
        name: name || undefined,
      })
      router.push("/portal")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code")
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {stage === "identify"
              ? "Enter your phone or email to receive a one-time code"
              : `Enter the 6-digit code sent to ${identifier}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {stage === "identify" ? (
            <>
              <Input
                placeholder="Phone or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                disabled={!identifier || requestOtp.isPending}
                onClick={handleRequestOtp}
              >
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
                {verifyOtp.isPending ? "Verifying..." : "Verify & sign in"}
              </Button>
              <Button variant="ghost" onClick={() => setStage("identify")}>
                Use a different phone/email
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

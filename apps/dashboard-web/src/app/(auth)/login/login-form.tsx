"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { getLandingPath } from "@rms/auth/route-access"
import { loginSchema, type LoginInput } from "@/lib/validators/auth"

const OPERATIONAL_WEB_URL = process.env.OPERATIONAL_WEB_URL ?? "http://localhost:3100"

export function LoginForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(body?.message ?? "Invalid email or password")
        return
      }

      // The login response already tells us isSuperadmin + portal (same
      // fields /auth/me resolves this from), so we can pick the final
      // destination right here instead of bouncing through "/" → "/dashboard"
      // → (cross-origin) "/" → "/staff" to work it out server-side one hop
      // at a time. Server-side layouts still re-verify and bounce on
      // mismatch (see (dashboard)/layout.tsx and staff/layout.tsx) — this is
      // just choosing the right first stop, not replacing that check.
      if (getLandingPath(body.user) === "/staff") {
        window.location.href = `${OPERATIONAL_WEB_URL}/staff`
        return
      }

      router.push("/dashboard")
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl type="email" placeholder="admin@rms.local" {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <div className="relative">
                <FormControl
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pr-9"
                  {...field}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@rms/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@rms/ui/form"
import { getLandingPath } from "@rms/auth/route-access"
import { loginSchema, type LoginInput } from "@rms/validators/auth"

const DASHBOARD_WEB_URL = process.env.NEXT_PUBLIC_DASHBOARD_WEB_URL

export function LoginForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  // Never leave credentials in a copied link, browser history, or referrer if
  // an older/native form submission put them in the query string.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("email") && !url.searchParams.has("password")) return
    url.searchParams.delete("email")
    url.searchParams.delete("password")
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }, [])

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

      // Same reasoning as dashboard-web's login form: the login response
      // already carries isSuperadmin + portal, so we can go straight to the
      // right app instead of "/" → (cross-origin) "/dashboard" one hop at a
      // time. staff/layout.tsx still re-verifies and bounces on mismatch.
      // A hasBothPortals user explicitly chose to log in here (operational
      // web), so they stay — only a dashboard-only user gets redirected.
      if (!body.user.hasBothPortals && getLandingPath(body.user) === "/dashboard") {
        if (!DASHBOARD_WEB_URL) {
          toast.error("Dashboard app URL is not configured")
          return
        }
        window.location.href = `${DASHBOARD_WEB_URL}/dashboard`
        return
      }

      router.push("/staff")
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl type="email" autoComplete="username" placeholder="staff@rms.local" {...field} />
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
                  autoComplete="current-password"
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

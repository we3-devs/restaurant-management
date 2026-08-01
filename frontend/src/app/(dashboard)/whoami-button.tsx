"use client"

import { useState } from "react"
import { UserCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api/client"
import type { CurrentUser } from "@/lib/auth/dal"

/** Debug helper: hits GET /auth/me straight from the browser and dumps the raw response — handy for checking permissions/outletIds/departmentIds without opening devtools. */
export function WhoAmIButton() {
  const [isLoading, setIsLoading] = useState(false)

  async function handleClick() {
    setIsLoading(true)
    try {
      const user = await apiClient<CurrentUser>("/auth/me")
      console.log("[/auth/me]", user)
      toast.success("GET /auth/me", {
        description: (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
        ),
        duration: 15000,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request to /auth/me failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={isLoading}
      aria-label="Call /auth/me"
      title="Call /auth/me"
    >
      <UserCircleIcon />
    </Button>
  )
}

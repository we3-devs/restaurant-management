"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? "Logging out..." : "Logout"}
    </Button>
  )
}

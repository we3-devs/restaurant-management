"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon, UserCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiClient } from "@/lib/api/client"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import type { CurrentUser } from "@/lib/auth/dal"

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

/** Combines the account identity, the /auth/me debug helper, and logout into one profile menu — replaces the row of separate header buttons with a single enterprise-style profile dropdown. */
export function UserMenu() {
  const user = useCurrentUser()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDebugging, setIsDebugging] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  async function handleWhoAmI() {
    setIsDebugging(true)
    try {
      const me = await apiClient<CurrentUser>("/auth/me")
      console.log("[/auth/me]", me)
      toast.success("GET /auth/me", {
        description: (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(me, null, 2)}
          </pre>
        ),
        duration: 15000,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request to /auth/me failed")
    } finally {
      setIsDebugging(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg py-1 pr-1 pl-1.5 transition-colors hover:bg-muted"
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium text-foreground sm:inline">{user.name}</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
          <span className="text-sm font-medium text-foreground">{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleWhoAmI} disabled={isDebugging}>
            <UserCircleIcon />
            {isDebugging ? "Calling /auth/me..." : "Debug: /auth/me"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
          <LogOutIcon />
          {isLoggingOut ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

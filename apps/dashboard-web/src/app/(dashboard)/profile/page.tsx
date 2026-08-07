"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon, MailIcon, ShieldCheckIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { SettingsRow, SettingsRowGroup } from "@/components/ui/settings-row"
import { DarkModeRow } from "@/components/ui/dark-mode-row"
import { useCurrentUser } from "@/lib/auth/current-user-context"

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

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}

export default function ProfilePage() {
  const user = useCurrentUser()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const roleLabel = user.isSuperadmin
    ? "Superadmin"
    : user.roleSlugs.length > 0
      ? user.roleSlugs.map(titleCase).join(", ")
      : "No role assigned"

  async function handleLogout() {
    setIsLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col space-y-4">
      <h1 className="text-lg font-semibold">Profile</h1>

      <Card className="gap-0 overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
        <div className="h-28 bg-linear-to-br from-accent via-accent to-primary/20" />
        <div className="flex flex-col items-center gap-1 px-6 pb-6">
          <Avatar className="-mt-14 size-24 bg-linear-to-br from-primary/25 to-primary/5 ring-4 ring-card">
            <AvatarFallback className="bg-transparent text-2xl font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <p className="mt-2 text-xl font-semibold leading-tight">{user.name}</p>
        </div>

        <div className="divide-y divide-border border-t border-border/60">
          <SettingsRow icon={ShieldCheckIcon} label="Role" trailing={<span className="text-sm text-muted-foreground">{roleLabel}</span>} />
          <SettingsRow icon={MailIcon} label="Mail" trailing={<span className="text-sm text-muted-foreground">{user.email}</span>} />
        </div>
      </Card>

      <SettingsRowGroup>
        <DarkModeRow />
      </SettingsRowGroup>

      <SettingsRowGroup className="mt-auto">
        <SettingsRow
          icon={LogOutIcon}
          label={isLoggingOut ? "Logging out…" : "Log out"}
          destructive
          onClick={handleLogout}
          disabled={isLoggingOut}
        />
      </SettingsRowGroup>
    </div>
  )
}

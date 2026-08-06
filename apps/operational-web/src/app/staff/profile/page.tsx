"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDownIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@rms/ui/avatar"
import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Card } from "@rms/ui/card"
import { Separator } from "@rms/ui/separator"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { APP_VERSION } from "@/lib/app-version"
import { PushNotificationsRequired } from "./push-notifications-required"

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

/** Groups flat "module.action" permission slugs into {module -> permission count}, in first-seen order, so the access card can show one pill per module instead of a wall of raw slugs. */
function groupByModule(permissions: string[]): Map<string, number> {
  const modules = new Map<string, number>()
  for (const slug of permissions) {
    const moduleName = slug.split(".")[0] ?? slug
    modules.set(moduleName, (modules.get(moduleName) ?? 0) + 1)
  }
  return modules
}

export default function StaffProfilePage() {
  const user = useCurrentUser()
  const router = useRouter()
  const [showAllPermissions, setShowAllPermissions] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const roleBadges = user.roleSlugs.length > 0 ? user.roleSlugs : user.isSuperadmin ? ["superadmin"] : []
  const permissionModules = groupByModule(user.permissions)

  async function handleLogout() {
    setIsLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Card className="items-center gap-3 rounded-2xl border-border/60 p-6 text-center shadow-none">
        <div className="relative">
          <Avatar className="size-20 bg-linear-to-br from-primary/20 to-primary/5 ring-4 ring-primary/10">
            <AvatarFallback className="bg-transparent text-xl font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        {roleBadges.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {roleBadges.map((slug) => (
              <Badge key={slug} variant={user.isSuperadmin ? "default" : "secondary"} className="gap-1">
                <ShieldCheckIcon className="size-3" />
                {titleCase(slug)}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="gap-3 rounded-2xl border-border/60 p-4 shadow-none">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Access</p>
            <p className="text-xs text-muted-foreground">
              {user.permissions.length} permission{user.permissions.length === 1 ? "" : "s"} across{" "}
              {permissionModules.size} module{permissionModules.size === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {permissionModules.size === 0 ? (
          <p className="text-sm text-muted-foreground">No permissions assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...permissionModules.entries()].map(([moduleName, count]) => (
              <Badge key={moduleName} variant="outline" className="text-xs">
                {titleCase(moduleName)}
                <span className="text-muted-foreground">{count}</span>
              </Badge>
            ))}
          </div>
        )}

        {user.permissions.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowAllPermissions((prev) => !prev)}
              className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDownIcon className={`size-3.5 transition-transform ${showAllPermissions ? "rotate-180" : ""}`} />
              {showAllPermissions ? "Hide full list" : "Show full list"}
            </button>
            {showAllPermissions && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-1.5">
                  {user.permissions.map((slug) => (
                    <Badge key={slug} variant="ghost" className="text-xs">
                      {slug}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Card>

      <PushNotificationsRequired />

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        <LogOutIcon />
        {isLoggingOut ? "Logging out..." : "Log out"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">App version {APP_VERSION}</p>
    </div>
  )
}

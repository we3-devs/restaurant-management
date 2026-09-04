"use client"

import { LayoutDashboardIcon, UtensilsIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Button } from "./button"
import { useCurrentUser } from "@rms/auth/current-user-context"

function targetPortalUrl(current: "dashboard" | "staff") {
  return current === "dashboard" ? "/operational" : "/dashboard"
}

/**
 * Icon-only jump link for cramped headers (e.g. the staff mobile shell) that
 * have no room for the full Select. Same `hasBothPortals` gate as
 * `HeaderPortalSwitcher` — just navigates straight to the other app instead
 * of presenting a picker.
 */
export function HeaderPortalLink({ current }: { current: "dashboard" | "staff" }) {
  const user = useCurrentUser()

  if (!user.hasBothPortals) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground"
      title={current === "dashboard" ? "Switch to Operational" : "Switch to Dashboard"}
      onClick={() => {
        window.location.href = targetPortalUrl(current)
      }}
    >
      {current === "dashboard" ? <UtensilsIcon className="size-4" /> : <LayoutDashboardIcon className="size-4" />}
    </Button>
  )
}

/**
 * Lets users who hold both dashboard and staff role assignments (or are
 * superadmin) jump between the two apps from the header — they're separate
 * deployments, so switching is a cross-origin navigation, not client
 * routing. Hidden entirely for everyone else, same as the outlet/department
 * switchers when there's nothing to pick from.
 */
export function HeaderPortalSwitcher({ current }: { current: "dashboard" | "staff" }) {
  const user = useCurrentUser()

  if (!user.hasBothPortals) return null

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v === current) return
        window.location.href = v === "dashboard" ? "/dashboard" : "/operational"
      }}
    >
      <SelectTrigger className="h-8 w-36 border-none bg-transparent text-sm shadow-none hover:bg-muted">
        {current === "dashboard" ? (
          <LayoutDashboardIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <UtensilsIcon className="size-3.5 text-muted-foreground" />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="dashboard">Dashboard</SelectItem>
        <SelectItem value="staff">Operational</SelectItem>
      </SelectContent>
    </Select>
  )
}

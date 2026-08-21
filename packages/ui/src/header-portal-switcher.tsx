"use client"

import { LayoutDashboardIcon, UtensilsIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { useCurrentUser } from "@rms/auth/current-user-context"

const OPERATIONAL_WEB_URL = process.env.NEXT_PUBLIC_OPERATIONAL_WEB_URL ?? "http://localhost:3100"
const DASHBOARD_WEB_URL = process.env.NEXT_PUBLIC_DASHBOARD_WEB_URL ?? "http://localhost:3000"

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
        window.location.href = v === "dashboard" ? `${DASHBOARD_WEB_URL}/dashboard` : `${OPERATIONAL_WEB_URL}/`
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

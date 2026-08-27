"use client"

import { useEffect, useState } from "react"
import { StoreIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { SettingsRow } from "./settings-row"
import { Skeleton } from "./skeleton"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"

/**
 * "Outlet" row for the profile page — the non-superadmin counterpart to
 * HeaderOutletSwitcher. Superadmins already switch (including to "All
 * Outlets") from the header, so this renders nothing for them. A
 * non-superadmin with one assigned outlet gets a static label; with several,
 * a Select of just their own assignments — "All Outlets" is never an option
 * here, same rule ActiveOutletProvider enforces underneath.
 */
export function OutletRow() {
  const { outletId, setOutletId, outlets, isLoadingOutlets, isSuperadmin } = useActiveOutlet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (isSuperadmin) return null
  if (!mounted || isLoadingOutlets) return <Skeleton className="h-[52px] w-full" />
  if (outlets.length === 0) return null

  const currentOutletName = outlets.find((o) => o.id === outletId)?.name ?? "—"

  return (
    <SettingsRow
      icon={StoreIcon}
      label="Outlet"
      trailing={
        outlets.length > 1 ? (
          <Select value={outletId ? String(outletId) : ""} onValueChange={(v) => setOutletId(Number(v))}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Select outlet" />
            </SelectTrigger>
            <SelectContent>
              {outlets.map((outlet) => (
                <SelectItem key={outlet.id} value={String(outlet.id)}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">{currentOutletName}</span>
        )
      }
    />
  )
}

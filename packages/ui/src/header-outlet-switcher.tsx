"use client"

import { useEffect, useState } from "react"
import { StoreIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Skeleton } from "./skeleton"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"

/** Kept for tenant-scoped staff layouts; platform superadmins use the tenant switcher. */
export function HeaderOutletSwitcher() {
  const { outletId, setOutletId, outlets, showOutletPicker, isLoadingOutlets, isSuperadmin } = useActiveOutlet()
  const [mounted, setMounted] = useState(false)

  // outletId is seeded from localStorage (see ActiveOutletProvider), which
  // doesn't exist during SSR — rendering it immediately would mismatch the
  // server-rendered "Select outlet" placeholder against whatever the client
  // had stored, so this waits for the client-only render pass.
  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  // Keep the header from reflowing while the outlet list is in flight — the
  // switcher sits next to the app title, so a late pop-in shifts everything.
  if (showOutletPicker && isLoadingOutlets) return <Skeleton className="h-8 w-44 rounded-md" />
  if (!showOutletPicker || isSuperadmin) return null

  return (
    <Select
      value={outletId ? String(outletId) : "all"}
      onValueChange={(v) => setOutletId(v && v !== "all" ? Number(v) : null)}
    >
      <SelectTrigger className="h-8 w-44 border-none bg-transparent text-sm shadow-none hover:bg-muted">
        <StoreIcon className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Select outlet" />
      </SelectTrigger>
      <SelectContent>
        {isSuperadmin && <SelectItem value="all">All Outlets</SelectItem>}
        {outlets.map((outlet) => (
          <SelectItem key={outlet.id} value={String(outlet.id)}>
            {outlet.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

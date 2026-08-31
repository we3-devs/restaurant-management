"use client"

import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useOperatingHours } from "@rms/api-client/hooks/use-operating-hours"

export function OperatingStatusBadge() {
  const { outletId } = useActiveOutlet()
  const { data } = useOperatingHours(outletId)
  if (!outletId || !data?.enabled) return null
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${data.isOpen ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
      {data.isOpen ? "Outlet open" : `Outlet closed${data.nextOpeningAt ? ` · opens ${new Date(data.nextOpeningAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}`}
    </span>
  )
}

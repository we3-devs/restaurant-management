"use client"

import { useEffect, useState } from "react"
import { StoreIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"

/** Global outlet switcher in the header — same ActiveOutletProvider every page already reads from, so switching here updates POS/Floor/Kitchen/dashboard consistently. Hidden when the user only has one outlet (same rule as every other outlet picker in the app). */
export function HeaderOutletSwitcher() {
  const { outletId, setOutletId, outlets, showOutletPicker } = useActiveOutlet()
  const [mounted, setMounted] = useState(false)

  // outletId is seeded from localStorage (see ActiveOutletProvider), which
  // doesn't exist during SSR — rendering it immediately would mismatch the
  // server-rendered "Select outlet" placeholder against whatever the client
  // had stored, so this waits for the client-only render pass.
  useEffect(() => setMounted(true), [])

  if (!mounted || !showOutletPicker) return null

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
        <SelectItem value="all">All Outlets</SelectItem>
        {outlets.map((outlet) => (
          <SelectItem key={outlet.id} value={String(outlet.id)}>
            {outlet.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

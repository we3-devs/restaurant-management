"use client"

import { useState } from "react"

import { DateRangeFilter } from "@/components/date-range-filter"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import {
  BreakdownSection,
  ChartsSection,
  InventoryActivitySection,
  StatCardsSection,
} from "../_shared/dashboard-sections"

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60_000)
  return { dateFrom: isoDate(from), dateTo: isoDate(to) }
}

export default function DashboardPage() {
  const user = useCurrentUser()
  // Outlet is a global concept (see the header switcher) — the dashboard just
  // follows whatever's currently active there instead of asking again.
  const { outletId, isLoadingOutlets } = useActiveOutlet()
  const [range, setRange] = useState(defaultRange)
  // Wait for the real outlet before firing any widget query — otherwise
  // every section fetches once with outletId undefined (an unscoped
  // all-outlets aggregate) and again once the outlet resolves.
  const dataEnabled = !isLoadingOutlets

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome, {user.name}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your business</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Each section fetches and renders independently — a slow widget never
          blocks the others from appearing. */}
      <StatCardsSection outletId={outletId} range={range} enabled={dataEnabled} />
      <ChartsSection outletId={outletId} range={range} enabled={dataEnabled} />
      <BreakdownSection outletId={outletId} range={range} enabled={dataEnabled} />
      <InventoryActivitySection outletId={outletId} range={range} enabled={dataEnabled} />
    </div>
  )
}

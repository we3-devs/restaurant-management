"use client"

import { useEffect, useState } from "react"

import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import {
  KitchenStatusSection,
  LiveOrdersSection,
  NeedsAttentionSection,
  OperationalKpiStrip,
  PaymentStatusSection,
  QUICK_ACTIONS,
  QuickActionsSection,
  RevenueSnapshotSection,
  StaffShiftSection,
  TableStatusSection,
} from "../_shared/operational-sections"

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function DashboardPage() {
  const user = useCurrentUser()
  // Outlet is a global concept (see the header switcher) — the dashboard just
  // follows whatever's currently active there instead of asking again.
  const { outletId, isLoadingOutlets } = useActiveOutlet()
  const now = useClock()
  // Wait for the real outlet before firing any widget query — otherwise
  // every section fetches once with outletId undefined (an unscoped
  // all-outlets aggregate) and again once the outlet resolves.
  const dataEnabled = !isLoadingOutlets

  const has = (permission: string | true) => permission === true || user.isSuperadmin || user.permissions.includes(permission)
  const canViewOrders = has("orders.view")
  const canViewKitchen = has("orders.view")
  const canViewTables = has("dining-tables.view")
  const canViewInventory = has("dashboard.view")
  const canViewStaff = has("attendance.view")
  const quickActions = QUICK_ACTIONS.filter((action) => has(action.permission))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting()}, {user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <OperationalKpiStrip outletId={outletId} enabled={dataEnabled} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canViewOrders ? (
            <LiveOrdersSection outletId={outletId} enabled={dataEnabled} />
          ) : null}
        </div>
        <NeedsAttentionSection
          outletId={outletId}
          enabled={dataEnabled}
          canViewOrders={canViewOrders}
          canViewKitchen={canViewKitchen}
          canViewInventory={canViewInventory}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canViewTables ? <TableStatusSection outletId={outletId} enabled={dataEnabled} /> : null}
        {canViewKitchen ? <KitchenStatusSection outletId={outletId} enabled={dataEnabled} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canViewInventory ? <RevenueSnapshotSection outletId={outletId} enabled={dataEnabled} /> : null}
        {canViewInventory ? <PaymentStatusSection outletId={outletId} enabled={dataEnabled} /> : null}
      </div>

      {canViewStaff ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <StaffShiftSection outletId={outletId} enabled={dataEnabled} />
        </div>
      ) : null}

      <QuickActionsSection actions={quickActions} />
    </div>
  )
}

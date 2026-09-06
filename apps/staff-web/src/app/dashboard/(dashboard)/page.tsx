"use client"

import { useEffect, useState } from "react"

import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { CreateOutletDialog } from "./outlets/create-outlet-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"
import {
  DiningAreasSection,
  DashboardStatsProvider,
  KitchenStatusSection,
  LiveOrdersSection,
  NeedsAttentionSection,
  OperationalKpiStrip,
  PaymentStatusSection,
  RevenueSnapshotSection,
  TableStatusSection,
} from "./_shared/operational-sections"

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
  const { outletId, outlets, isLoadingOutlets } = useActiveOutlet()
  const now = useClock()
  // Wait for the real outlet before firing any widget query — otherwise
  // every section fetches once with outletId undefined (an unscoped
  // all-outlets aggregate) and again once the outlet resolves.
  const dataEnabled = !isLoadingOutlets

  const has = (permission: string | true) => permission === true || user.isSuperadmin || user.permissions.includes(permission)
  const canViewOrders = has("orders.view")
  const canViewKitchen = has("orders.view")
  const canViewTables = has("dining-tables.view")
  const canViewDashboardStats = has("dashboard.view")

  const noOutletsYet = !isLoadingOutlets && outlets.length === 0

  usePageTitle("Dashboard")

  return (
    <div className="dashboard-page page-shell space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting()}, {user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {noOutletsYet ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">No outlets yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first outlet to start taking orders, managing tables, and tracking inventory.
          </p>
          {user.isSuperadmin && <CreateOutletDialog />}
        </div>
      ) : (
        <DashboardStatsProvider outletId={outletId} enabled={dataEnabled && canViewDashboardStats}>
          <NeedsAttentionSection
            outletId={outletId}
            enabled={dataEnabled}
            canViewOrders={canViewOrders}
            canViewKitchen={canViewKitchen}
            canViewDashboardStats={canViewDashboardStats}
          />
          {canViewDashboardStats ? <OperationalKpiStrip outletId={outletId} enabled={dataEnabled} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canViewOrders ? (
            <LiveOrdersSection outletId={outletId} enabled={dataEnabled} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canViewTables ? <TableStatusSection outletId={outletId} enabled={dataEnabled} /> : null}
        {canViewKitchen ? <KitchenStatusSection outletId={outletId} enabled={dataEnabled} /> : null}
      </div>

      {canViewTables ? (
        <div className="grid grid-cols-1 gap-4">
          <DiningAreasSection outletId={outletId} enabled={dataEnabled} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canViewDashboardStats ? <RevenueSnapshotSection outletId={outletId} enabled={dataEnabled} /> : null}
        {canViewDashboardStats ? <PaymentStatusSection outletId={outletId} enabled={dataEnabled} /> : null}
      </div>

        </DashboardStatsProvider>
      )}
    </div>
  )
}

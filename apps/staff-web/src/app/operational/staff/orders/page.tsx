"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { StatusBadge } from "@rms/ui/status-badge"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { tableSessionName, useTableSessions, type TableSession } from "@rms/api-client/hooks/use-table-sessions"
import { useOrders, type Order } from "@rms/api-client/hooks/use-orders"
import { useSettingsCategory, type BusinessSettings } from "@rms/api-client/hooks/use-settings"
import { ORDER_STATUSES } from "@rms/validators/orders"
import { useCurrentUser } from "@rms/auth/current-user-context"

// Mirrors backend/src/common/reporting/reporting-date.util.ts's default — the
// same business-day boundary the dashboard/analytics "today" figures use.
const DEFAULT_BUSINESS_TIMEZONE = "Asia/Kathmandu"

/** "Today" by the tenant's configured business timezone, not the device's own clock/timezone — a tester (or any staff member) whose device isn't set to the outlet's local time would otherwise see today's orders silently filtered out, or yesterday's still showing, right around the business's midnight. */
function businessDateKey(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
  }
}

interface OrderRow {
  order: Order
  tableName: string
  customerName: string
  sessionLabel: string
}

/**
 * Cashier-facing order list — today's orders only, identified by table +
 * customer + session instead of an order number (that's an internal detail
 * nobody at the counter reads off), always newest first. Tapping a row goes
 * straight to the existing /staff/orders/[id] page, which already has the
 * full payment/refund flow (see PaymentSummaryCard in order-detail.tsx) —
 * no need to duplicate that here.
 */
export default function StaffOrdersPage() {
  const { outletId } = useActiveOutlet()
  const { positionSlugs } = useCurrentUser()
  const isWaiter = positionSlugs.includes("waiter")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { data: orders, isLoading } = useOrders(
    {
      outletId: outletId ?? undefined,
      limit: 500,
      status: statusFilter === "open" || statusFilter === "all" ? undefined : statusFilter,
      excludeStatus: statusFilter === "open" ? ["completed", "cancelled"] : undefined,
    },
    { enabled: !!outletId },
  )
  const { data: sessions } = useTableSessions({ outletId: outletId ?? undefined, limit: 200 })
  const { data: businessSettings } = useSettingsCategory<BusinessSettings>("business")
  const timeZone = businessSettings?.timezone || DEFAULT_BUSINESS_TIMEZONE
  const showSkeleton = useDelayedLoading(isLoading)

  const rows = useMemo<OrderRow[]>(() => {
    const sessionById = new Map<number, TableSession>((sessions?.data ?? []).map((s) => [s.id, s]))
    const todayKey = businessDateKey(new Date(), timeZone)

    const withNames = (orders?.data ?? [])
      .filter((order) => businessDateKey(new Date(order.createdAt), timeZone) === todayKey)
      .map((order) => {
        const session = order.tableSessionId ? sessionById.get(order.tableSessionId) : undefined
        const tableName = order.tableName ?? order.orderType.replace(/_/g, " ")
        // The list endpoint already resolves this server-side (same as
        // tableName above) — no need to fetch and index the whole customer
        // table client-side just to look up a name.
        const customerName = order.customerName ?? session?.customer?.name ?? "Walk-in"
        const sessionLabel = session ? tableSessionName(session) : "—"
        return { order, tableName, customerName, sessionLabel }
      })

    return [...withNames].sort(
      (a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime(),
    )
  }, [orders, sessions, timeZone])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Today&apos;s orders</h1>
      </div>

      <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="all">All</SelectItem>
          {ORDER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!outletId && <p className="text-sm text-muted-foreground">Select an outlet to view orders.</p>}
      {outletId && showSkeleton && <ListSkeleton count={6} />}
      {outletId && !showSkeleton && rows.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No orders yet today.</p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <OrderRowCard key={row.order.id} row={row} isWaiter={isWaiter} />
        ))}
      </div>
    </div>
  )
}

function OrderRowCard({ row, isWaiter }: { row: OrderRow; isWaiter: boolean }) {
  const { order, tableName, customerName, sessionLabel } = row

  return (
    <Link
      href={`/operational/staff/orders/${order.id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-input p-3 transition-colors hover:bg-muted"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">
            {tableName} · {customerName}
          </span>
          <StatusBadge status={order.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">{sessionLabel}</p>
      </div>
      {!isWaiter && (
        <div className="shrink-0 text-right text-sm">
          <p className="font-medium">{order.grandTotal}</p>
          {order.dueAmount > 0 && <p className="text-destructive">Due {order.dueAmount}</p>}
        </div>
      )}
    </Link>
  )
}

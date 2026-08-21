"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { StatusBadge } from "@rms/ui/status-badge"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { tableSessionName, useTableSessions, type TableSession } from "@rms/api-client/hooks/use-table-sessions"
import { useOrders, type Order } from "@rms/api-client/hooks/use-orders"
import { ORDER_STATUSES } from "@rms/validators/orders"

/** Same calendar day as `now`, in the browser's local timezone. */
function isToday(isoDate: string): boolean {
  const date = new Date(isoDate)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

interface OrderRow {
  order: Order
  tableName: string
  customerName: string
  sessionLabel: string
}

const SORT_OPTIONS = [
  { value: "placedAt-desc", label: "Newest first" },
  { value: "placedAt-asc", label: "Oldest first" },
  { value: "table-asc", label: "Table (A–Z)" },
  { value: "total-desc", label: "Total (high–low)" },
] as const

/**
 * Cashier-facing order list — today's orders only, identified by table +
 * customer + session instead of an order number (that's an internal detail
 * nobody at the counter reads off), sortable via the control below since a
 * mobile screen has no room for clickable column headers. Tapping a row
 * goes straight to the existing /staff/orders/[id] page, which already has
 * the full payment/refund flow (see PaymentSummaryCard in order-detail.tsx)
 * — no need to duplicate that here.
 */
export default function StaffOrdersPage() {
  const { outletId } = useActiveOutlet()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("placedAt-desc")
  const { data: orders, isLoading } = useOrders(
    {
      outletId: outletId ?? undefined,
      limit: 200,
      status: statusFilter === "open" || statusFilter === "all" ? undefined : statusFilter,
      excludeStatus: statusFilter === "open" ? ["completed", "cancelled"] : undefined,
    },
    { enabled: !!outletId },
  )
  const { data: sessions } = useTableSessions({ outletId: outletId ?? undefined, limit: 200 })
  const { data: tables } = useDiningTables({ outletId: outletId ?? undefined, limit: 200 })
  const { data: customers } = useCustomers({ limit: 200 })
  const showSkeleton = useDelayedLoading(isLoading)

  const rows = useMemo<OrderRow[]>(() => {
    const sessionById = new Map<number, TableSession>((sessions?.data ?? []).map((s) => [s.id, s]))
    const tableNameById = new Map<number, string>((tables?.data ?? []).map((t) => [t.id, t.name]))
    const customerNameById = new Map<number, string>((customers?.data ?? []).map((c) => [c.id, c.name]))

    const withNames = (orders?.data ?? [])
      .filter((order) => isToday(order.createdAt))
      .map((order) => {
        const session = order.tableSessionId ? sessionById.get(order.tableSessionId) : undefined
        const tableName = session ? (tableNameById.get(session.diningTableId) ?? "—") : order.orderType.replace(/_/g, " ")
        const customerName = order.customerId
          ? (customerNameById.get(order.customerId) ?? "Loading…")
          : (session?.customer?.name ?? "Walk-in")
        const sessionLabel = session ? tableSessionName(session) : "—"
        return { order, tableName, customerName, sessionLabel }
      })

    const [field, direction] = sort.split("-") as ["placedAt" | "table" | "total", "asc" | "desc"]
    const sorted = [...withNames].sort((a, b) => {
      if (field === "table") return a.tableName.localeCompare(b.tableName)
      if (field === "total") return a.order.grandTotal - b.order.grandTotal
      return new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime()
    })
    return direction === "desc" ? sorted.reverse() : sorted
  }, [orders, sessions, tables, customers, sort])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Today&apos;s orders</h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
        <Select value={sort} onValueChange={(value) => value && setSort(value as typeof sort)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!outletId && <p className="text-sm text-muted-foreground">Select an outlet to view orders.</p>}
      {outletId && showSkeleton && <ListSkeleton count={6} />}
      {outletId && !showSkeleton && rows.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No orders yet today.</p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <OrderRowCard key={row.order.id} row={row} />
        ))}
      </div>
    </div>
  )
}

function OrderRowCard({ row }: { row: OrderRow }) {
  const { order, tableName, customerName, sessionLabel } = row

  return (
    <Link
      href={`/staff/orders/${order.id}`}
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
      <div className="shrink-0 text-right text-sm">
        <p className="font-medium">{order.grandTotal}</p>
        {order.dueAmount > 0 && <p className="text-destructive">Due {order.dueAmount}</p>}
      </div>
    </Link>
  )
}

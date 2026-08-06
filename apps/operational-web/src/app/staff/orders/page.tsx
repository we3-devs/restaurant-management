"use client"

import { useState } from "react"
import Link from "next/link"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Skeleton } from "@rms/ui/skeleton"
import { StatusBadge } from "@rms/ui/status-badge"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useCustomer } from "@rms/api-client/hooks/use-customers"
import { useTableSession } from "@rms/api-client/hooks/use-table-sessions"
import { useOrders, type Order } from "@rms/api-client/hooks/use-orders"
import { ORDER_STATUSES } from "@rms/validators/orders"

const OPEN_STATUSES: string[] = ORDER_STATUSES.filter((status) => status !== "completed" && status !== "cancelled")

/**
 * Cashier-facing order list — table + customer per row instead of the full
 * cart/order-taking screen (that's still reachable by tapping a table from
 * Tables; this is purely for finding an order to pay). Tapping a row goes
 * straight to the existing /orders/[id] page, which already has the full
 * payment/refund flow (see PaymentSummaryCard in order-detail.tsx) — no
 * need to duplicate that here.
 */
export default function StaffOrdersPage() {
  const { outletId } = useActiveOutlet()
  const [statusFilter, setStatusFilter] = useState<string>("open")
  const { data, isLoading } = useOrders(
    {
      outletId: outletId ?? undefined,
      limit: 100,
      status: statusFilter === "open" || statusFilter === "all" ? undefined : statusFilter,
    },
    { enabled: !!outletId },
  )

  const orders = data?.data ?? []
  const visible = statusFilter === "open" ? orders.filter((order) => OPEN_STATUSES.includes(order.status)) : orders

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Orders</h1>
        <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
          <SelectTrigger className="w-36">
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
      </div>

      {!outletId && <p className="text-sm text-muted-foreground">Select an outlet to view orders.</p>}
      {outletId && isLoading && <Skeleton className="h-64 w-full" />}
      {outletId && !isLoading && visible.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No orders to show.</p>
      )}

      <div className="space-y-2">
        {visible.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}

function OrderRow({ order }: { order: Order }) {
  const { data: session } = useTableSession(order.tableSessionId ?? 0)
  const { data: customer } = useCustomer(order.customerId ?? 0)

  return (
    <Link
      href={`/staff/orders/${order.id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-input p-3 transition-colors hover:bg-muted"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">#{order.orderNumber}</span>
          <StatusBadge status={order.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {session?.diningTableName ?? order.orderType.replace(/_/g, " ")}
          {" · "}
          {customer?.name ?? "Walk-in"}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm">
        <p className="font-medium">{order.grandTotal}</p>
        {order.dueAmount > 0 && <p className="text-destructive">Due {order.dueAmount}</p>}
      </div>
    </Link>
  )
}

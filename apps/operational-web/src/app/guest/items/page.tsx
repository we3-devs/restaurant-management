"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { Badge } from "@rms/ui/badge"
import { Card } from "@rms/ui/card"
import { Skeleton } from "@rms/ui/skeleton"
import { useGuestOrderRealtime } from "@/app/guest/guest-order-tracker"
import { useMyGuestOrders, type GuestOrder, type GuestOrderItem } from "@rms/api-client/hooks/use-guest-orders"

const ITEM_STATUS_LABEL: Record<string, string> = {
  stock_reserved: "Queued",
  sent_to_kitchen: "Sent to kitchen",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
}

const ITEM_STATUS_VARIANT: Record<string, "outline" | "info" | "success" | "secondary" | "destructive"> = {
  stock_reserved: "outline",
  sent_to_kitchen: "info",
  preparing: "info",
  ready: "success",
  served: "secondary",
  cancelled: "destructive",
}

function itemName(item: GuestOrderItem): string {
  const base = item.food?.name ?? `Item #${item.foodId}`
  return item.foodVariant ? `${base} — ${item.foodVariant.name}` : base
}

export default function GuestItemsPage() {
  return (
    <Suspense fallback={<GuestItemsShell><Skeleton className="h-40 w-full max-w-md" /></GuestItemsShell>}>
      <GuestItemsInner />
    </Suspense>
  )
}

function GuestItemsInner() {
  const searchParams = useSearchParams()
  const tableCode = searchParams.get("table") ?? ""

  useGuestOrderRealtime(tableCode)
  const { data: orders, isLoading } = useMyGuestOrders(tableCode)
  // Every order from this table's current visit, not just one — see
  // OrdersService.findMineForCustomer (scoped to the table's latest
  // session) and the "Track every item" link on GuestOrderTracker.
  const activeOrders = (orders ?? []).filter((order) => order.status !== "cancelled")

  if (isLoading) {
    return (
      <GuestItemsShell tableCode={tableCode}>
        <Skeleton className="h-40 w-full max-w-md" />
      </GuestItemsShell>
    )
  }

  if (activeOrders.length === 0) {
    return (
      <GuestItemsShell tableCode={tableCode}>
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-sm font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Items you order will show up here.</p>
        </Card>
      </GuestItemsShell>
    )
  }

  return (
    <GuestItemsShell tableCode={tableCode}>
      <div className="flex w-full max-w-md flex-col gap-3">
        {activeOrders.map((order) => (
          <OrderItemsCard key={order.id} order={order} />
        ))}
      </div>
    </GuestItemsShell>
  )
}

function OrderItemsCard({ order }: { order: GuestOrder }) {
  return (
    <Card className="w-full p-4 sm:p-6">
      <p className="text-xs font-medium text-muted-foreground">Bill No: {order.billNumber ?? order.orderNumber}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.quantity}× {itemName(item)}
              </p>
              {item.note && <p className="truncate text-xs text-muted-foreground">{item.note}</p>}
            </div>
            <Badge variant={ITEM_STATUS_VARIANT[item.status] ?? "outline"} className="shrink-0">
              {ITEM_STATUS_LABEL[item.status] ?? item.status}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function GuestItemsShell({ tableCode, children }: { tableCode?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/40 p-6">
      <div className="mb-4 w-full max-w-md">
        <Link
          href={tableCode ? `/guest?table=${encodeURIComponent(tableCode)}` : "/guest"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to table
        </Link>
      </div>
      {children}
    </div>
  )
}

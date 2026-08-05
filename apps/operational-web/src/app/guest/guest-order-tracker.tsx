"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@rms/ui/button"
import { queryKeys } from "@rms/api-client/query-keys"
import { acquireGuestSocket, releaseGuestSocket } from "@rms/api-client/realtime/guest-socket"
import { cn } from "@rms/ui/cn"
import { useCancelGuestOrder, useMyGuestOrders, type GuestOrder } from "@rms/api-client/hooks/use-guest-orders"

/** Invalidates the guest's order list the moment the backend pushes a status change (see notifyGuestOrderChanged in kitchen-tickets.gateway.ts), instead of waiting for the next poll. Shared with the per-item tracker on /guest/items. */
export function useGuestOrderRealtime(tableCode: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tableCode) return
    const socket = acquireGuestSocket()
    const onOrderUpdated = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.guestOrders.mine(tableCode) })

    socket.on("guest.order.updated", onOrderUpdated)
    return () => {
      socket.off("guest.order.updated", onOrderUpdated)
      releaseGuestSocket()
    }
  }, [tableCode, queryClient])
}

const MILESTONES = ["Order sent", "Accepted", "Prepared", "Served"] as const
const CANCELLABLE_STATUSES = ["pending", "accepted"]

// Order.status -> milestone stage. OrdersService.syncStatusFromItems now
// walks Order.status itself through the kitchen's real progress (sent ->
// preparing -> partially_ready/ready -> partially_served/served) as items
// change, pushed live over the guest socket — so the order's own status is
// the source of truth here, not a client-side aggregate of its items.
const ORDER_STAGE: Record<string, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  partially_ready: 2,
  ready: 2,
  partially_served: 3,
  served: 3,
  completed: 3,
}

function orderMilestone(status: string): number {
  return ORDER_STAGE[status] ?? 0
}

/** Stage 2/3's label reflects "partially" statuses (some but not all items prepared/served) while the order is currently sitting in that state — otherwise falls back to the generic milestone label. */
function milestoneLabel(status: string, index: number): string {
  if (index === 2 && status === "partially_ready") return "Partially prepared"
  if (index === 3 && status === "partially_served") return "Partially Served"
  return MILESTONES[index]
}

function useActiveGuestOrders(tableCode: string) {
  const { data: orders } = useMyGuestOrders(tableCode)
  return (orders ?? []).filter((order) => order.status !== "cancelled")
}

/**
 * Link to /guest/items (every item from every order on this visit, grouped
 * by order) — sits above the table/call-staff card, at the very top of the
 * page, so it's the first thing a returning guest sees. Pairs with
 * GuestOrderTracker, which renders the per-order milestone cards at the
 * bottom of the page instead.
 */
export function GuestTrackItemsLink({ tableCode }: { tableCode: string }) {
  useGuestOrderRealtime(tableCode)
  const activeOrders = useActiveGuestOrders(tableCode)

  if (activeOrders.length === 0) return null

  return (
    <Link
      href={`/guest/items?table=${encodeURIComponent(tableCode)}`}
      className="flex w-full max-w-md items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      <span>Track every item</span>
      <ChevronRightIcon className="size-4" />
    </Link>
  )
}

/**
 * Shows every order the guest has placed on this table's current visit as a
 * stack of cards, most recent first — a guest who orders twice (mains, then
 * dessert) keeps seeing both trackers instead of the earlier one vanishing
 * the moment a newer order exists. Pinned at the bottom of the page, below
 * the call-staff/order-yourself card — see GuestTrackItemsLink for the link
 * pinned at the top.
 */
export function GuestOrderTracker({ tableCode }: { tableCode: string }) {
  useGuestOrderRealtime(tableCode)
  const activeOrders = useActiveGuestOrders(tableCode)

  if (activeOrders.length === 0) return null

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {activeOrders.map((order) => (
        <GuestOrderCard key={order.id} order={order} tableCode={tableCode} />
      ))}
    </div>
  )
}

function GuestOrderCard({ order, tableCode }: { order: GuestOrder; tableCode: string }) {
  const cancelOrder = useCancelGuestOrder(tableCode)
  const current = orderMilestone(order.status)
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)

  async function handleCancel() {
    try {
      await cancelOrder.mutateAsync(order.id)
      toast.success("Order cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel — it may already be in the kitchen")
    }
  }

  return (
    <div className="w-full rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Bill No: {order.billNumber ?? order.orderNumber}</p>
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-destructive hover:text-destructive"
            disabled={cancelOrder.isPending}
            onClick={handleCancel}
          >
            {cancelOrder.isPending ? "Cancelling..." : "Cancel order"}
          </Button>
        )}
      </div>
      <div className="flex items-center">
        {MILESTONES.map((_, index) => {
          const label = milestoneLabel(order.status, index)
          const done = index <= current
          const isLast = index === MILESTONES.length - 1
          return (
            <div key={index} className={cn("flex items-center", !isLast && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" /> : index + 1}
                </div>
                <span className={cn("text-[11px] whitespace-nowrap", done ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
              {!isLast && (
                <div className={cn("mx-1.5 h-0.5 flex-1 rounded-full", index < current ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

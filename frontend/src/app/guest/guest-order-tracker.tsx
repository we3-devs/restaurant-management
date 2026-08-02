"use client"

import { CheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCancelGuestOrder, useMyGuestOrders } from "@/hooks/use-guest-orders"

const MILESTONES = ["Order sent", "Accepted", "Prepared", "Served"] as const
const CANCELLABLE_STATUSES = ["pending", "accepted"]

/** Collapses the backend's fine-grained order statuses into the 4 guest-facing milestones. */
function milestoneIndex(status: string): number {
  switch (status) {
    case "pending":
      return 0
    case "accepted":
      return 1
    case "preparing":
    case "partially_ready":
    case "ready":
      return 2
    case "partially_served":
    case "served":
    case "completed":
      return 3
    default:
      return 0
  }
}

/**
 * Shows the guest's most recent active order as a horizontal milestone
 * stepper at the top of the page — pinned above the call-staff/order
 * sections so status is visible without hunting for it.
 */
export function GuestOrderTracker({ tableCode }: { tableCode: string }) {
  const { data: orders } = useMyGuestOrders(tableCode)
  const cancelOrder = useCancelGuestOrder(tableCode)
  const activeOrder = (orders ?? []).find((order) => order.status !== "cancelled")

  if (!activeOrder) return null

  const current = milestoneIndex(activeOrder.status)
  const canCancel = CANCELLABLE_STATUSES.includes(activeOrder.status)

  async function handleCancel() {
    if (!activeOrder) return
    try {
      await cancelOrder.mutateAsync(activeOrder.id)
      toast.success("Order cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel — it may already be in the kitchen")
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Order #{activeOrder.orderNumber}</p>
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
        {MILESTONES.map((label, index) => {
          const done = index <= current
          const isLast = index === MILESTONES.length - 1
          return (
            <div key={label} className={cn("flex items-center", !isLast && "flex-1")}>
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

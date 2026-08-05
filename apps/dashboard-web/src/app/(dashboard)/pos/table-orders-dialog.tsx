"use client"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateOrder, type Order } from "@/hooks/use-orders"

/**
 * A table session carries a single shared order/cart (see
 * OrdersService.createFromGuest) — this dialog only ever needs to either
 * open that one order, or (for a session that's been seated but hasn't had
 * an order started yet) create the first one. It intentionally does not
 * offer "start another order" — a second order for an already-carted table
 * would fork the cart instead of sharing it. If more than one open order
 * ever does exist (e.g. leftover from before single-cart, or an explicit
 * staff override elsewhere), it's shown as a one-off pick list rather than
 * silently landing on whichever happens to be most recent.
 */
export function TableOrdersDialog({
  open,
  onOpenChange,
  tableName,
  tableSessionId,
  outletId,
  orders,
  onSelectOrder,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableName: string
  tableSessionId: number
  outletId: number
  orders: Order[]
  onSelectOrder: (orderId: number) => void
}) {
  const createOrder = useCreateOrder()

  async function handleStartOrder() {
    try {
      const order = await createOrder.mutateAsync({ outletId, tableSessionId, orderType: "table" })
      onOpenChange(false)
      onSelectOrder(order.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start the order")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {tableName}
            {orders.length > 0
              ? ` — ${orders.length} open order${orders.length === 1 ? "" : "s"}`
              : " has no order yet"}
          </DialogTitle>
        </DialogHeader>
        {orders.length > 0 ? (
          <div className="flex flex-col gap-2">
            {orders.map((order) => (
              <Button
                key={order.id}
                variant="outline"
                className="justify-between"
                onClick={() => {
                  onOpenChange(false)
                  onSelectOrder(order.id)
                }}
              >
                <span>#{order.orderNumber}</span>
                <span className="text-xs text-muted-foreground">{order.status}</span>
              </Button>
            ))}
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={handleStartOrder} disabled={createOrder.isPending}>
              {createOrder.isPending ? "Starting..." : "Start order"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

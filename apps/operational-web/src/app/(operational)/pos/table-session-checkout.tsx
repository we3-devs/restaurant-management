"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { useCreateTableSessionPayment, useCompleteAllForTableSession } from "@rms/api-client/hooks/use-order-payments"
import type { Order } from "@rms/api-client/hooks/use-orders"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"
import { ORDER_PAYMENT_METHODS } from "@rms/validators/orders"

/**
 * Grouped view of every open order on this table session plus one combined
 * "pay the whole table" action — pays off the oldest order's balance first,
 * then the next, instead of staff switching between orders to settle each
 * one separately. Rendered by CheckoutPanel in place of its usual
 * single-order payment section once a session has more than one open order.
 */
export function TableSessionCheckout({
  tableSessionId,
  orders,
}: {
  tableSessionId: number
  orders: Order[]
}) {
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const createPayment = useCreateTableSessionPayment(tableSessionId)
  const completeAll = useCompleteAllForTableSession(tableSessionId)

  const totalDue = orders.reduce((sum, order) => sum + order.dueAmount, 0)

  const [paymentMethod, setPaymentMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  const [paymentAmount, setPaymentAmount] = useState(totalDue)
  // Re-seeds the payment-amount field whenever the combined due changes
  // (e.g. after a payment lands) — mirrors CheckoutPanel's own pattern.
  const [seededDue, setSeededDue] = useState<number | null>(null)
  if (totalDue !== seededDue) {
    setSeededDue(totalDue)
    setPaymentAmount(totalDue)
  }

  async function handlePay() {
    if (paymentAmount <= 0) return
    if (!isOnline) {
      toast.error("You're offline — reconnect to record a payment")
      return
    }
    try {
      await createPayment.mutateAsync({ method: paymentMethod, amount: paymentAmount })
      toast.success("Payment recorded across the table")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    }
  }

  async function handleCompleteAll() {
    if (!isOnline) {
      toast.error("You're offline — reconnect to complete the table")
      return
    }
    try {
      const completed = await completeAll.mutateAsync()
      // Nothing was ordered on any of this table's orders — there's no bill
      // to show or print, just close out the table.
      if (completed.every((order) => order.subtotal === 0)) {
        toast.success("Table closed — no sale")
        router.push("/floor")
      } else {
        toast.success("Table closed out")
        router.push(`/pos/receipt/${completed[0].id}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete the table")
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Table bill — {orders.length} open orders</p>

      <div className="space-y-1.5">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between rounded-lg border border-input p-2 text-xs">
            <div>
              <p className="font-medium">#{order.orderNumber}</p>
              <p className="text-muted-foreground">{order.status}</p>
            </div>
            <div className="text-right">
              <p>{order.grandTotal}</p>
              <p className="text-muted-foreground">Due {order.dueAmount}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm font-medium">
        <span>Total due (all orders)</span>
        <span>{totalDue}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={paymentMethod}
          onValueChange={(value) => value && setPaymentMethod(value as (typeof ORDER_PAYMENT_METHODS)[number])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_PAYMENT_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(Number(e.target.value))}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePay}
        disabled={createPayment.isPending || paymentAmount <= 0 || !isOnline}
      >
        {createPayment.isPending ? "Recording..." : "Pay across table"}
      </Button>

      <Button
        className="w-full"
        size="lg"
        onClick={handleCompleteAll}
        disabled={totalDue > 0 || completeAll.isPending || !isOnline}
      >
        {!isOnline ? "Offline" : totalDue > 0 ? `Due ${totalDue}` : "Complete table"}
      </Button>
    </div>
  )
}

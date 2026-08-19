"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { useCreateTableSessionPayment, useCompleteAllForTableSession } from "@rms/api-client/hooks/use-order-payments"
import { useOrderItems, type Order } from "@rms/api-client/hooks/use-orders"
import { useFoods } from "@rms/api-client/hooks/use-foods"
import { useFoodVariants } from "@rms/api-client/hooks/use-food-variants"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { ORDER_PAYMENT_METHODS } from "@rms/validators/orders"

const ITEM_STATUS_LABELS: Record<string, string> = {
  stock_reserved: "Pending",
  sent_to_kitchen: "Sent",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
}

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
  const [creditCustomerId, setCreditCustomerId] = useState<number | undefined>(undefined)
  const { data: customers, isLoading: customersLoading } = useCustomers({ limit: 50 })
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
    if (paymentMethod === "credit" && !creditCustomerId) {
      toast.error("Select a customer to charge this to their tab")
      return
    }
    try {
      await createPayment.mutateAsync({
        method: paymentMethod,
        amount: paymentAmount,
        customerId: paymentMethod === "credit" ? creditCustomerId : undefined,
      })
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
          <OrderWithItems key={order.id} order={order} />
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
      {paymentMethod === "credit" && (
        <Select
          value={creditCustomerId ? String(creditCustomerId) : ""}
          onValueChange={(value) => setCreditCustomerId(value ? Number(value) : undefined)}
        >
          <SelectTrigger className="w-full" disabled={customersLoading}>
            <SelectValue placeholder={customersLoading ? "Loading…" : "Charge to customer's tab"} />
          </SelectTrigger>
          <SelectContent>
            {customers?.data.map((customer) => (
              <SelectItem key={customer.id} value={String(customer.id)}>
                {customer.name}
                {customer.phone ? ` (${customer.phone})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePay}
        disabled={
          createPayment.isPending ||
          paymentAmount <= 0 ||
          !isOnline ||
          (paymentMethod === "credit" && !creditCustomerId)
        }
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

/** One order's summary plus its item list — not-served items first, so the cashier sees at a glance what's still outstanding before what's already gone out. */
function OrderWithItems({ order }: { order: Order }) {
  const { data: items } = useOrderItems(order.id)
  const { data: foods } = useFoods({ limit: 100 })
  const { data: variants } = useFoodVariants({ limit: 100 })
  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`
  const variantName = (foodVariantId: number | null) =>
    foodVariantId ? (variants?.data.find((v) => v.id === foodVariantId)?.name ?? null) : null

  const sortedItems = [...(items?.data ?? [])].sort((a, b) => {
    const rank = (status: string) => (status === "served" || status === "cancelled" ? 1 : 0)
    return rank(a.status) - rank(b.status)
  })

  return (
    <div className="rounded-lg border border-input p-2 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">#{order.orderNumber}</p>
          <p className="text-muted-foreground">{order.status}</p>
        </div>
        <div className="text-right">
          <p>{order.grandTotal}</p>
          <p className="text-muted-foreground">Due {order.dueAmount}</p>
        </div>
      </div>
      {sortedItems.length > 0 && (
        <div className="mt-1.5 space-y-1 border-t border-input pt-1.5">
          {sortedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <span className={item.status === "served" ? "text-muted-foreground line-through" : ""}>
                {item.quantity}x {foodName(item.foodId)}
                {variantName(item.foodVariantId) ? ` — ${variantName(item.foodVariantId)}` : ""}
                {item.packagingType === "takeaway" ? " (takeaway)" : ""}
              </span>
              <Badge variant={item.status === "served" ? "secondary" : "outline"} className="shrink-0 text-xs">
                {ITEM_STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

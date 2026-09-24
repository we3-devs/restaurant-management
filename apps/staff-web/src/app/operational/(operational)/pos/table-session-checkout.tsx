"use client"

import { useState } from "react"
import { PrinterIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { BillReceiptDialog } from "@rms/ui/bill-receipt-dialog"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { OrderDiscountForm } from "@rms/ui/order-discount-form"
import { PaymentMethodPicker } from "@rms/ui/payment-method-picker"
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
  sent_to_kitchen: "Accepted",
  preparing: "Accepted",
  ready: "Prepared",
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
  basePath = "/operational/pos",
}: {
  tableSessionId: number
  orders: Order[]
  /** Order-taking/receipt route this panel navigates into — desktop POS by default, staff mobile passes its own route. */
  basePath?: string
}) {
  const isOnline = useOnlineStatus()
  const createPayment = useCreateTableSessionPayment(tableSessionId)
  const completeAll = useCompleteAllForTableSession(tableSessionId)

  const totalDue = orders.reduce((sum, order) => sum + order.dueAmount, 0)

  const [paymentMethod, setPaymentMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  // Raw text, not a number: starts empty and is never auto-filled from the
  // combined due amount — mirrors CheckoutPanel's own pattern.
  const [paymentAmount, setPaymentAmount] = useState("")
  const parsedPaymentAmount = Number(paymentAmount)
  const isValidPaymentAmount = paymentAmount.trim() !== "" && Number.isFinite(parsedPaymentAmount) && parsedPaymentAmount > 0
  const [creditCustomerId, setCreditCustomerId] = useState<number | undefined>(undefined)
  const { data: customers, isLoading: customersLoading } = useCustomers({ limit: 50 })

  async function handlePay() {
    if (!isValidPaymentAmount) return
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
        amount: parsedPaymentAmount,
        customerId: paymentMethod === "credit" ? creditCustomerId : undefined,
      })
      setPaymentAmount("")
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
      // Stay put instead of bouncing to the receipt page — each order's bill
      // can be printed from the buttons above whenever it's needed, before
      // or after completion.
      toast.success(completed.every((order) => order.subtotal === 0) ? "Table closed — no sale" : "Table closed out")
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

      <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Amount</span>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Enter amount"
          value={paymentAmount}
          onChange={(e) => {
            const next = e.target.value
            if (/^\d*\.?\d*$/.test(next)) setPaymentAmount(next)
          }}
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
          !isValidPaymentAmount ||
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
  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? "Loading…"
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
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p>{order.grandTotal}</p>
            <p className="text-muted-foreground">Due {order.dueAmount}</p>
          </div>
          <BillReceiptDialog
            orderId={order.id}
            trigger={
              <Button variant="ghost" size="icon" aria-label="View / print bill">
                <PrinterIcon className="size-4" />
              </Button>
            }
          />
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
      <div className="mt-1.5 border-t border-input pt-1.5">
        <OrderDiscountForm orderId={order.id} />
      </div>
    </div>
  )
}

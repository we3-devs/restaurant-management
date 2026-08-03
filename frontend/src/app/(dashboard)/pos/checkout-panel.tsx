"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useCreateOrderPayment, useOrderPayments } from "@/hooks/use-order-payments"
import { useOrder, useOrders, useUpdateOrder, useUpdateOrderStatus } from "@/hooks/use-orders"
import { useOnlineStatus } from "@/lib/offline/online-status"
import { ORDER_DISCOUNT_TYPES, ORDER_PAYMENT_METHODS } from "@/lib/validators/orders"
import { TableSessionCheckout } from "./table-session-checkout"

const CLOSED_ORDER_STATUSES = new Set(["completed", "cancelled"])

export function CheckoutPanel({ orderId }: { orderId: number }) {
  const router = useRouter()
  const { data: order } = useOrder(orderId)
  const { data: payments } = useOrderPayments(orderId)
  const updateOrder = useUpdateOrder(orderId)
  const updateStatus = useUpdateOrderStatus(orderId)
  const createPayment = useCreateOrderPayment(orderId)
  const isOnline = useOnlineStatus()

  // A table session can carry more than one open order now — if this one
  // isn't alone, hand off to the combined "pay/complete the whole table"
  // view below instead of only ever letting staff settle one order at a
  // time. tableSessionId=-1 (grab-and-go/stay/delivery orders, or before
  // `order` has loaded) is the codebase's established "don't have a real id
  // yet" sentinel — see pos/page.tsx's deep-link resolution for the same pattern.
  const { data: siblingOrders } = useOrders({
    tableSessionId: order?.tableSessionId ?? -1,
    limit: 100,
  })
  const openSiblingOrders = (siblingOrders?.data ?? []).filter(
    (candidate) => !CLOSED_ORDER_STATUSES.has(candidate.status),
  )

  const [discountType, setDiscountType] = useState<string>("none")
  const [discountValue, setDiscountValue] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [serviceChargeAmount, setServiceChargeAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  const [paymentAmount, setPaymentAmount] = useState(0)

  // Re-seed the editable totals/payment-amount fields whenever a different
  // order loads, or the due amount changes after a payment — without an
  // effect, per React's "adjusting state when a prop changes" pattern.
  const [seededOrderId, setSeededOrderId] = useState<number | null>(null)
  const [seededDueAmount, setSeededDueAmount] = useState<number | null>(null)
  if (order && order.id !== seededOrderId) {
    setSeededOrderId(order.id)
    setDiscountType(order.discountType ?? "none")
    setDiscountValue(order.discountValue)
    setTaxAmount(order.taxAmount)
    setServiceChargeAmount(order.serviceChargeAmount)
  }
  if (order && order.dueAmount !== seededDueAmount) {
    setSeededDueAmount(order.dueAmount)
    setPaymentAmount(order.dueAmount)
  }

  if (!order) return null

  async function handleSaveTotals() {
    try {
      await updateOrder.mutateAsync({
        discountType: discountType === "none" ? undefined : (discountType as "flat" | "percentage"),
        discountValue,
        taxAmount,
        serviceChargeAmount,
      })
      toast.success("Totals updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update totals")
    }
  }

  async function handleAddPayment() {
    if (paymentAmount <= 0) return
    if (!isOnline) {
      toast.error("You're offline — reconnect to record a payment")
      return
    }
    try {
      await createPayment.mutateAsync({ type: "payment", method: paymentMethod, amount: paymentAmount })
      toast.success("Payment recorded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    }
  }

  async function handleCompleteSale() {
    if (!isOnline) {
      toast.error("You're offline — reconnect to complete the sale")
      return
    }
    try {
      await updateStatus.mutateAsync("completed")
      toast.success("Sale complete")
      router.push(`/pos/receipt/${orderId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete sale")
    }
  }

  return (
    <div className="space-y-3 border-t border-input pt-3">
      <div className="grid grid-cols-2 gap-1 text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="text-right">{order.subtotal}</span>
        <span className="text-muted-foreground">Discount</span>
        <span className="text-right">{order.discountAmount}</span>
        <span className="text-muted-foreground">Tax</span>
        <span className="text-right">{order.taxAmount}</span>
        <span className="text-muted-foreground">Service charge</span>
        <span className="text-right">{order.serviceChargeAmount}</span>
        <span className="font-medium">Grand total</span>
        <span className="text-right font-medium">{order.grandTotal}</span>
        <span className="text-muted-foreground">Paid</span>
        <span className="text-right">{order.paidAmount}</span>
        <span className="font-medium">Due</span>
        <span className="text-right font-medium">{order.dueAmount}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={discountType} onValueChange={(value) => value && setDiscountType(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No discount</SelectItem>
            {ORDER_DISCOUNT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          value={discountValue}
          onChange={(e) => setDiscountValue(Number(e.target.value))}
          placeholder="Discount value"
        />
        <Input
          type="number"
          step="0.01"
          value={taxAmount}
          onChange={(e) => setTaxAmount(Number(e.target.value))}
          placeholder="Tax"
        />
        <Input
          type="number"
          step="0.01"
          value={serviceChargeAmount}
          onChange={(e) => setServiceChargeAmount(Number(e.target.value))}
          placeholder="Service charge"
        />
      </div>
      <Button variant="outline" size="sm" onClick={handleSaveTotals} disabled={updateOrder.isPending}>
        {updateOrder.isPending ? "Saving..." : "Apply"}
      </Button>

      <Separator />

      {openSiblingOrders.length > 1 && order.tableSessionId ? (
        // This order shares its table session with at least one other open
        // order (a guest QR order alongside a staff POS order, or two POS
        // rounds rung up separately) — settle and close the whole table in
        // one action instead of one order at a time.
        <TableSessionCheckout tableSessionId={order.tableSessionId} orders={openSiblingOrders} />
      ) : (
        <>
          <div className="space-y-1.5">
            {(payments?.data ?? []).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>{payment.type}</Badge>
                  <span>{payment.method}</span>
                </div>
                <span>{payment.amount}</span>
              </div>
            ))}
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
            onClick={handleAddPayment}
            disabled={createPayment.isPending || paymentAmount <= 0 || !isOnline}
          >
            {createPayment.isPending ? "Recording..." : "Add payment"}
          </Button>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCompleteSale}
            disabled={order.dueAmount > 0 || updateStatus.isPending || !isOnline}
          >
            {!isOnline ? "Offline" : order.dueAmount > 0 ? `Due ${order.dueAmount}` : "Complete sale"}
          </Button>
        </>
      )}
    </div>
  )
}

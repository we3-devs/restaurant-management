"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { BillReceipt } from "@rms/ui/bill-receipt"
import { Badge } from "@rms/ui/badge"
import { StatusBadge } from "@rms/ui/status-badge"
import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Separator } from "@rms/ui/separator"
import { Skeleton } from "@rms/ui/skeleton"
import { useCustomer, useCustomerOutlets } from "@rms/api-client/hooks/use-customers"
import { useLoyaltyAccount } from "@rms/api-client/hooks/use-loyalty"
import { useCreateOrderPayment, useOrderPayments } from "@rms/api-client/hooks/use-order-payments"
import { useOrder, useUpdateOrder } from "@rms/api-client/hooks/use-orders"
import { ORDER_DISCOUNT_TYPES, ORDER_PAYMENT_METHODS } from "@rms/validators/orders"

/**
 * Read-only for the order's items and table assignment (removed entirely —
 * both are changed from POS/kitchen instead). Billing itself — discount/
 * tax/service charge and recording payments — stays editable here, since
 * that's a normal thing to do while looking at an order's bill, not
 * "editing" its contents.
 */
export function OrderDetail({ orderId }: { orderId: number }) {
  const { data: order, isLoading } = useOrder(orderId)

  if (isLoading || !order) {
    return <Skeleton className="h-96 w-full max-w-5xl" />
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{order.orderNumber}</h1>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary">{order.orderType}</Badge>
            <StatusBadge status={order.paymentStatus} />
          </div>
        </div>
        <Badge>{order.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentBox orderId={orderId} />
        <BillView orderId={orderId} />
      </div>

      {order.customerId && <CustomerSection customerId={order.customerId} outletId={order.outletId} />}
    </div>
  )
}

function CustomerSection({ customerId, outletId }: { customerId: number; outletId: number }) {
  const { data: customer } = useCustomer(customerId)
  const { data: loyalty } = useLoyaltyAccount(customerId)
  const { data: outlets } = useCustomerOutlets(customerId)
  const visitCount = outlets?.find((visit) => visit.outletId === outletId)?.visitCount ?? 0

  if (!customer) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">Name</span>
          <span className="text-right">{customer.name}</span>
          <span className="text-muted-foreground">Phone</span>
          <span className="text-right">{customer.phone ?? "—"}</span>
          <span className="text-muted-foreground">Loyalty points</span>
          <span className="text-right">{loyalty?.currentPoints ?? 0}</span>
          <span className="text-muted-foreground">Visits at this outlet</span>
          <span className="text-right">{visitCount}</span>
        </div>
        <Link href={`/customers/${customerId}`} className="inline-block text-sm text-primary hover:underline">
          View customer profile
        </Link>
      </CardContent>
    </Card>
  )
}

/** Left column: discount/tax/service charge (editable — the one other exception to view-only, same reasoning as payments), the payment ledger, and a form to record a new payment. */
function PaymentBox({ orderId }: { orderId: number }) {
  const { data: order } = useOrder(orderId)
  const { data: payments } = useOrderPayments(orderId)
  const createPayment = useCreateOrderPayment(orderId)
  const updateOrder = useUpdateOrder(orderId)

  const [method, setMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  const [amount, setAmount] = useState(0)
  // Re-seeds the amount field to the current due whenever it changes (e.g.
  // after a payment lands), without needing an effect.
  const [seededDue, setSeededDue] = useState<number | null>(null)
  if (order && order.dueAmount !== seededDue) {
    setSeededDue(order.dueAmount)
    setAmount(order.dueAmount)
  }

  const [discountType, setDiscountType] = useState<string>("none")
  const [discountValue, setDiscountValue] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [serviceChargeAmount, setServiceChargeAmount] = useState(0)
  const [seededOrderId, setSeededOrderId] = useState<number | null>(null)
  if (order && order.id !== seededOrderId) {
    setSeededOrderId(order.id)
    setDiscountType(order.discountType ?? "none")
    setDiscountValue(order.discountValue)
    setTaxAmount(order.taxAmount)
    setServiceChargeAmount(order.serviceChargeAmount)
  }

  const isLocked = order?.status === "completed"

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

  async function handleRecordPayment() {
    if (amount <= 0) return
    try {
      await createPayment.mutateAsync({ type: "payment", method, amount })
      toast.success("Payment recorded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    }
  }

  if (!order) return <Skeleton className="h-64 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
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
          <span className="text-muted-foreground">Refunded</span>
          <span className="text-right">{order.refundedAmount}</span>
        </div>

        {!isLocked && (
          <div className="space-y-2 border-t border-input pt-4">
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
          </div>
        )}

        <Separator />

        <div className="space-y-1.5">
          {(payments?.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          {(payments?.data ?? []).map((payment) => (
            <div key={payment.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>{payment.type}</Badge>
                <span>{payment.method}</span>
              </div>
              <span>{payment.amount}</span>
            </div>
          ))}
        </div>

        {!isLocked && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Select value={method} onValueChange={(value) => value && setMethod(value as typeof method)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_PAYMENT_METHODS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <Button
              className="w-full"
              onClick={handleRecordPayment}
              disabled={createPayment.isPending || amount <= 0}
            >
              {createPayment.isPending ? "Recording..." : "Record payment"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Right column: the order rendered the same way a printed receipt would be — see pos/receipt/[orderId]/receipt-view.tsx for the standalone/printable version. Both render the shared BillReceipt so the bill looks identical everywhere. */
function BillView({ orderId }: { orderId: number }) {
  const { data: order } = useOrder(orderId)

  if (!order) return <Skeleton className="h-64 w-full" />

  return (
    <Card>
      <CardContent className="p-6">
        <BillReceipt orderId={orderId} />
      </CardContent>
    </Card>
  )
}

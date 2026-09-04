"use client"

import { useState } from "react"
import Link from "next/link"
import { PrinterIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { BillSummary } from "@rms/ui/bill-summary"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { OrderDiscountForm } from "@rms/ui/order-discount-form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Separator } from "@rms/ui/separator"
import { useCreateOrderPayment, useOrderPayments } from "@rms/api-client/hooks/use-order-payments"
import {
  useOrder,
  useOrderItems,
  useOrders,
  useUpdateOrderStatus,
} from "@rms/api-client/hooks/use-orders"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"
import { ORDER_PAYMENT_METHODS } from "@rms/validators/orders"
import { calculatePaymentTotals } from "@rms/validators/payment-totals"
import { TableSessionCheckout } from "./table-session-checkout"
import { useOperatingHours } from "@rms/api-client/hooks/use-operating-hours"
import { ClosedHoursOverrideButton } from "@/components/closed-hours-override-button"

const CLOSED_ORDER_STATUSES = new Set(["completed", "cancelled"])

export function CheckoutPanel({
  orderId,
  basePath = "/operational/pos",
}: {
  orderId: number
  /** Order-taking/receipt route this panel navigates into — desktop POS by default, staff mobile passes its own route. */
  basePath?: string
}) {
  // basePath is the order-taking route ("/operational/pos" or "/operational/staff/waiter/pos"), but
  // the receipt page doesn't live under it — it's its own top-level
  // staff-shell page (see staff/nav-items.ts) — so derive it separately
  // rather than nesting off basePath.
  const receiptPath = basePath.startsWith("/operational/staff") ? `/operational/staff/pos/receipt/${orderId}` : `/operational/pos/receipt/${orderId}`
  const { data: order } = useOrder(orderId)
  const { data: orderItems } = useOrderItems(orderId)
  const { data: payments } = useOrderPayments(orderId)
  const updateStatus = useUpdateOrderStatus(orderId)
  const updateStatusOverride = useUpdateOrderStatus(orderId, { closedHoursOverride: true })
  const createPayment = useCreateOrderPayment(orderId)
  const createPaymentOverride = useCreateOrderPayment(orderId, { closedHoursOverride: true })
  const isOnline = useOnlineStatus()
  const { data: operatingHours } = useOperatingHours(order?.outletId ?? null)

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

  const [paymentMethod, setPaymentMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [creditCustomerId, setCreditCustomerId] = useState<number | undefined>(undefined)
  const { data: customers, isLoading: customersLoading } = useCustomers({ limit: 50 })

  // Prefer the payment ledger for the visible totals. The order detail may be
  // briefly stale immediately after recording a payment.
  const paymentTotals = payments && order ? calculatePaymentTotals(order.grandTotal, payments.data) : null
  const paidAmount = paymentTotals?.paidAmount ?? order?.paidAmount ?? 0
  const displayedDueAmount = paymentTotals?.dueAmount ?? order?.dueAmount ?? 0

  // Re-seed the editable totals/payment-amount fields whenever a different
  // order loads, or the due amount changes after a payment — without an
  // effect, per React's "adjusting state when a prop changes" pattern.
  const [seededDueAmount, setSeededDueAmount] = useState<number | null>(null)
  if (order && displayedDueAmount !== seededDueAmount) {
    setSeededDueAmount(displayedDueAmount)
    setPaymentAmount(displayedDueAmount)
  }

  // Items still sitting in the cart (added but never "Send to kitchen"'d,
  // or held) keep the order from ever reaching 'served', which is the only
  // status 'completed' can follow — so the backend will reject the sale.
  // Surface that up front instead of letting the cashier hit a confusing
  // generic error after the fact.
  const unsentItemCount = (orderItems?.data ?? []).filter(
    (item) => item.status === "stock_reserved",
  ).length

  if (!order) return null

  async function handleAddPayment() {
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
        type: "payment",
        method: paymentMethod,
        amount: paymentAmount,
        customerId: paymentMethod === "credit" ? creditCustomerId : undefined,
      })
      toast.success("Payment recorded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    }
  }

  async function handleCompleteSale() {
    if (!order) return
    if (!isOnline) {
      toast.error("You're offline — reconnect to complete the sale")
      return
    }
    try {
      await updateStatus.mutateAsync("completed")
      // Stay put instead of bouncing to the receipt page — the bill can be
      // printed from the button above whenever it's needed, before or after
      // completion.
      toast.success(order.subtotal === 0 ? "Table closed — no sale" : "Sale complete")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete sale")
    }
  }

  async function handleCompleteSaleOverride() {
    if (!order) return
    await updateStatusOverride.mutateAsync("completed")
    toast.success(order.subtotal === 0 ? "Table closed — no sale" : "Sale complete")
  }

  return (
    <div className="space-y-3 border-t border-input pt-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" render={<Link href={receiptPath} target="_blank" rel="noopener noreferrer" />}>
          <PrinterIcon />
          View / print bill
        </Button>
      </div>

      <BillSummary order={{ ...order, paidAmount, dueAmount: displayedDueAmount }} />

      <OrderDiscountForm orderId={orderId} />

      <Separator />

      {openSiblingOrders.length > 1 && order.tableSessionId ? (
        // This order shares its table session with at least one other open
        // order (a guest QR order alongside a staff POS order, or two POS
        // rounds rung up separately) — settle and close the whole table in
        // one action instead of one order at a time.
        <TableSessionCheckout
          tableSessionId={order.tableSessionId}
          orders={openSiblingOrders}
          basePath={basePath}
        />
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
              onValueChange={(value) => {
                if (!value) return
                setPaymentMethod(value as (typeof ORDER_PAYMENT_METHODS)[number])
                if (value === "credit") setCreditCustomerId(order.customerId ?? undefined)
              }}
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
            onClick={handleAddPayment}
            disabled={
              createPayment.isPending ||
              paymentAmount <= 0 ||
              !isOnline ||
              (paymentMethod === "credit" && !creditCustomerId)
            }
          >
            {createPayment.isPending ? "Recording..." : "Add payment"}
          </Button>
          <ClosedHoursOverrideButton
            closed={operatingHours?.enabled === true && operatingHours.isOpen === false}
            label="add payment"
            onConfirm={async () => {
              await createPaymentOverride.mutateAsync({
                type: "payment",
                method: paymentMethod,
                amount: paymentAmount,
                customerId: paymentMethod === "credit" ? creditCustomerId : undefined,
              })
              toast.success("Payment recorded")
            }}
          />

          <Button
            className="w-full"
            size="lg"
            onClick={handleCompleteSale}
            disabled={displayedDueAmount > 0 || unsentItemCount > 0 || updateStatus.isPending || !isOnline}
          >
            {!isOnline
              ? "Offline"
              : displayedDueAmount > 0
                ? `Due ${displayedDueAmount}`
                : unsentItemCount > 0
                  ? `Send ${unsentItemCount} item${unsentItemCount === 1 ? "" : "s"} to kitchen first`
                  : "Complete sale"}
          </Button>
          <ClosedHoursOverrideButton
            closed={operatingHours?.enabled === true && operatingHours.isOpen === false}
            label="complete sale"
            onConfirm={handleCompleteSaleOverride}
          />
        </>
      )}
    </div>
  )
}

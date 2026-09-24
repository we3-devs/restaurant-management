"use client"

import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@rms/ui/alert-dialog"
import { Badge } from "@rms/ui/badge"
import { BillReceiptDialog } from "@rms/ui/bill-receipt-dialog"
import { BillSummary } from "@rms/ui/bill-summary"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { OrderDiscountForm } from "@rms/ui/order-discount-form"
import { PaymentMethodPicker } from "@rms/ui/payment-method-picker"
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
import { CreateCustomerDialog } from "./create-customer-dialog"
import { useOperatingHours } from "@rms/api-client/hooks/use-operating-hours"
import { ClosedHoursOverrideButton } from "@/components/closed-hours-override-button"
import { useCurrentUser } from "@rms/auth/current-user-context"

const CLOSED_ORDER_STATUSES = new Set(["completed", "cancelled"])

export function CheckoutPanel({
  orderId,
  basePath = "/operational/pos",
}: {
  orderId: number
  /** Order-taking/receipt route this panel navigates into — desktop POS by default, staff mobile passes its own route. */
  basePath?: string
}) {
  const { data: order } = useOrder(orderId)
  const { data: orderItems } = useOrderItems(orderId)
  const { data: payments } = useOrderPayments(orderId)
  const updateStatus = useUpdateOrderStatus(orderId)
  const updateStatusOverride = useUpdateOrderStatus(orderId, { closedHoursOverride: true })
  const user = useCurrentUser()
  // Force-completing voids whatever never got served — as discretionary as
  // cancelling an order, so it rides on the same permission (see
  // OrdersController#updateStatus).
  const canForceComplete = user.permissions.includes("orders.delete")
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
  // Raw text, not a number: starts empty and is never auto-filled from the
  // due amount, so it can't silently snap to a stale figure while an order
  // update is still in flight, and staff always type the exact amount
  // they're actually handed rather than trusting a pre-filled guess.
  const [paymentAmount, setPaymentAmount] = useState("")
  const parsedPaymentAmount = Number(paymentAmount)
  const isValidPaymentAmount = paymentAmount.trim() !== "" && Number.isFinite(parsedPaymentAmount) && parsedPaymentAmount > 0
  const [creditCustomerId, setCreditCustomerId] = useState<number | undefined>(undefined)
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const { data: customers, isLoading: customersLoading } = useCustomers({ limit: 50 })

  // Prefer the payment ledger for the visible totals. The order detail may be
  // briefly stale immediately after recording a payment.
  const paymentTotals = payments && order ? calculatePaymentTotals(order.grandTotal, payments.data) : null
  const paidAmount = paymentTotals?.paidAmount ?? order?.paidAmount ?? 0
  const displayedDueAmount = paymentTotals?.dueAmount ?? order?.dueAmount ?? 0

  // Anything not yet 'served' (or voided) — including items still sitting in
  // the cart, never sent to kitchen. Purely informational for the main
  // Complete button ("Complete sale" passes autoServe, which marks all of
  // these served instead of requiring the normal serve step first); still
  // gates the separate destructive "void instead" option below, which needs
  // orders.delete.
  const unservedItemCount = (orderItems?.data ?? []).filter(
    (item) => item.status !== "served" && item.status !== "cancelled",
  ).length

  if (!order) return null

  async function handleAddPayment() {
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
        type: "payment",
        method: paymentMethod,
        amount: parsedPaymentAmount,
        customerId: paymentMethod === "credit" ? creditCustomerId : undefined,
      })
      setPaymentAmount("")
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
      // autoServe is a no-op when everything's already served — passing it
      // unconditionally means "Complete sale" always just works instead of
      // staff having to separately mark every item served first. Unlike
      // force (below), it doesn't drop anything from the bill: unserved
      // items are marked served, not voided, so the sale still charges and
      // consumes stock for them normally.
      await updateStatus.mutateAsync({ status: "completed", autoServe: true })
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
    await updateStatusOverride.mutateAsync({ status: "completed", autoServe: true })
    toast.success(order.subtotal === 0 ? "Table closed — no sale" : "Sale complete")
  }

  async function handleForceCompleteSale() {
    if (!order) return
    if (!isOnline) {
      toast.error("You're offline — reconnect to complete the sale")
      return
    }
    try {
      await updateStatus.mutateAsync({
        status: "completed",
        force: true,
        note: "Force-completed without full service",
      })
      toast.success("Sale complete — unserved items voided")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete sale")
    }
  }

  return (
    <div className="space-y-3 border-t border-input pt-3">
      <div className="flex justify-end">
        <BillReceiptDialog orderId={orderId} />
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

          <PaymentMethodPicker
            value={paymentMethod}
            onChange={(method) => {
              setPaymentMethod(method)
              if (method === "credit") setCreditCustomerId(order.customerId ?? undefined)
            }}
          />
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Amount</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Enter amount"
              value={paymentAmount}
              onChange={(e) => {
                const next = e.target.value
                // Digits and at most one decimal point — text input (not
                // type="number") so the field can be genuinely empty and
                // has no increment/decrement spinner.
                if (/^\d*\.?\d*$/.test(next)) setPaymentAmount(next)
              }}
            />
          </div>
          {paymentMethod === "credit" && (
            <>
              <Select
                value={creditCustomerId ? String(creditCustomerId) : ""}
                onValueChange={(value) => {
                  if (value === "create") {
                    setCreateCustomerOpen(true)
                    return
                  }
                  setCreditCustomerId(value ? Number(value) : undefined)
                }}
              >
                <SelectTrigger className="w-full" disabled={customersLoading}>
                  <SelectValue placeholder={customersLoading ? "Loading…" : "Charge to customer's tab"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">+ Create customer</SelectItem>
                  {customers?.data.map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>
                      {customer.name}
                      {customer.phone ? ` (${customer.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CreateCustomerDialog
                open={createCustomerOpen}
                onOpenChange={setCreateCustomerOpen}
                onCreated={(customer) => setCreditCustomerId(customer.id)}
              />
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddPayment}
            disabled={
              createPayment.isPending ||
              !isValidPaymentAmount ||
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
                amount: parsedPaymentAmount,
                customerId: paymentMethod === "credit" ? creditCustomerId : undefined,
              })
              setPaymentAmount("")
              toast.success("Payment recorded")
            }}
          />

          <Button
            className="w-full"
            size="lg"
            onClick={handleCompleteSale}
            disabled={displayedDueAmount > 0 || updateStatus.isPending || !isOnline}
          >
            {!isOnline
              ? "Offline"
              : displayedDueAmount > 0
                ? `Due ${displayedDueAmount}`
                : unservedItemCount > 0
                  ? `Complete sale (${unservedItemCount} unserved item${unservedItemCount === 1 ? "" : "s"} will auto-serve)`
                  : "Complete sale"}
          </Button>

          {displayedDueAmount <= 0 && unservedItemCount > 0 && canForceComplete && isOnline && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button className="w-full" size="sm" variant="outline" disabled={updateStatus.isPending}>
                    Void {unservedItemCount} unserved item{unservedItemCount === 1 ? "" : "s"} instead
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Void unserved items and complete?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {unservedItemCount} item{unservedItemCount === 1 ? " hasn't" : "s haven't"} been served yet. This
                    drops {unservedItemCount === 1 ? "it" : "them"} from the bill entirely (releasing any reserved
                    stock) instead of charging for and serving {unservedItemCount === 1 ? "it" : "them"} — use this
                    only when the guest genuinely didn't get {unservedItemCount === 1 ? "it" : "them"}. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleForceCompleteSale}>
                    Void and complete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
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

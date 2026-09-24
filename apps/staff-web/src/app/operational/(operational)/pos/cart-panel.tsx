"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2Icon,
  CircleDollarSignIcon,
  FlameIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ReceiptIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useCurrentUser } from "@rms/auth/current-user-context"
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
import { Label } from "@rms/ui/label"
import { OrderDiscountForm } from "@rms/ui/order-discount-form"
import { PaymentMethodPicker } from "@rms/ui/payment-method-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Separator } from "@rms/ui/separator"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useCustomerCreditAccount } from "@rms/api-client/hooks/use-customer-credit"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { useMenu } from "@rms/api-client/hooks/use-menu"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"
import { useOperatingHours } from "@rms/api-client/hooks/use-operating-hours"
import { ClosedHoursOverrideButton } from "@/components/closed-hours-override-button"
import { useCreateOrderPayment, useOrderPayments } from "@rms/api-client/hooks/use-order-payments"
import {
  useAddOrderItemsBatch,
  useFireHeldItems,
  useOrder,
  useOrderItems,
  useRemoveOrderItem,
  useSendOrderToKitchen,
  useTableSessionItems,
  useUpdateOrderItem,
  useUpdateOrderStatus,
  type Order,
  type OrderItem,
} from "@rms/api-client/hooks/use-orders"
import { ORDER_PAYMENT_METHODS } from "@rms/validators/orders"
import { calculatePaymentTotals } from "@rms/validators/payment-totals"
import { useLocalCartContext } from "./local-cart-context"
import type { LocalCartItem } from "./use-local-cart"

const ITEM_STATUS_LABELS: Record<string, string> = {
  sent_to_kitchen: "Accepted",
  preparing: "Accepted",
  ready: "Prepared",
  served: "Served",
  cancelled: "Cancelled",
}

export function CartPanel({ orderId, basePath = "/operational/pos" }: { orderId: number; basePath?: string }) {
  // The tables board is its own top-level staff-shell page (see
  // staff/nav-items.ts), not nested under basePath.
  const tablesPath = basePath.startsWith("/operational/staff") ? "/operational/staff/tables" : "/operational/floor"
  const { data: order } = useOrder(orderId)

  // Nothing left to do once the sale is closed out — items can no longer be
  // edited and payment is done, so collapse to a read-only summary instead
  // of the full editable cart.
  if (order?.status === "completed") {
    return <CompletedSaleSummary order={order} tablesPath={tablesPath} />
  }

  return <EditableCart orderId={orderId} />
}

function CompletedSaleSummary({
  order,
  tablesPath,
}: {
  order: Order
  tablesPath: string
}) {
  const router = useRouter()

  // The order-taking screens behind this one (table pick, food grid, cart)
  // are no longer valid once the sale is closed out — pressing browser Back
  // must not resurrect them. Push a throwaway history entry the moment this
  // view mounts, then on the resulting Back press (popstate), replace
  // straight to the tables board instead of letting the browser pop back
  // to whatever was there before.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href)
    function handlePopState() {
      router.replace(tablesPath)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [router, tablesPath])

  return (
    <div className="flex w-full flex-col gap-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase">Payment info</h3>
      <BillSummary order={order} />
      <BillReceiptDialog orderId={order.id} />
      <Button onClick={() => router.replace(tablesPath)}>Go to tables</Button>
    </div>
  )
}

function EditableCart({ orderId }: { orderId: number }) {
  const { data: items, isLoading } = useOrderItems(orderId)
  const { data: order } = useOrder(orderId)
  // Every item ordered during this table's whole visit (across every
  // round/order), for the read-only waiter view below — a waiter tracking a
  // table cares about everything sent for it, not just this one Order row.
  const { data: tableSessionItems, isLoading: tableSessionItemsLoading } = useTableSessionItems(
    order?.tableSessionId ?? 0,
  )
  const waiterSentItems = tableSessionItems?.data.filter((item) => item.status !== "stock_reserved") ?? []
  const { data: menu } = useMenu(order?.outletId ?? null)
  const { data: payments } = useOrderPayments(orderId)
  const createPayment = useCreateOrderPayment(orderId)
  const createPaymentOverride = useCreateOrderPayment(orderId, { closedHoursOverride: true })
  const updateStatus = useUpdateOrderStatus(orderId)
  const updateStatusOverride = useUpdateOrderStatus(orderId, { closedHoursOverride: true })
  const { data: customers, isLoading: customersLoading } = useCustomers({ limit: 50 })
  const user = useCurrentUser()
  // Waiters take orders but don't collect payment — that's the cashier's
  // job at the table (see floor/table-actions-dialog for the same split).
  // Gate on the actual backend permission (order-payments.manage), not the
  // literal "cashier" position slug — slugs are free-text and admin-defined,
  // so a cashier-equivalent position with a different slug would otherwise
  // be denied the Pay UI despite holding the permission.
  const canRecordPayment = user.permissions.includes("order-payments.manage")
  // Matches the backend gate in OrderItemsController#update — once an item
  // is out of stock_reserved (sent to the kitchen) editing its
  // quantity/note/packaging is cashier/admin-only; a waiter's view of it is
  // read-only (see ReadOnlySentItemRow below).
  const canEditSentItems = canRecordPayment || user.permissions.includes("orders.delete")
  // Force-completing voids whatever never got served — as discretionary as
  // cancelling an order, so it rides on the same permission (see
  // OrdersController#updateStatus).
  const canForceComplete = user.permissions.includes("orders.delete")
  const localCart = useLocalCartContext()
  const addItemsBatch = useAddOrderItemsBatch(orderId)
  const addItemsBatchOverride = useAddOrderItemsBatch(orderId, { closedHoursOverride: true })
  const sendToKitchen = useSendOrderToKitchen(orderId)
  const sendToKitchenOverride = useSendOrderToKitchen(orderId, { closedHoursOverride: true })
  const fireHeld = useFireHeldItems(orderId)
  const fireHeldOverride = useFireHeldItems(orderId, { closedHoursOverride: true })
  const { data: operatingHours } = useOperatingHours(order?.outletId ?? null)
  const isOnline = useOnlineStatus()

  // Credit payments settle the order (it counts toward dueAmount same as
  // cash) but the money itself sits on the customer's tab, not in the
  // till — split it out of "Paid" so the waiter isn't misled into thinking
  // cash/card was actually collected.
  // The payment ledger is the source of truth for the screen. During the
  // short window after a payment is saved, the order detail can still contain
  // the previous paid/due totals; using the loaded ledger prevents showing a
  // payment of 250 alongside Paid 0 / Due 250.
  const ledgerTotals = payments && order ? calculatePaymentTotals(order.grandTotal, payments.data) : null
  const ledgerPaidAmount = ledgerTotals?.paidAmount ?? order?.paidAmount ?? 0
  const creditAmount = payments
    ? payments.data
        .filter((p) => p.status === "completed" && p.method === "credit")
        .reduce((sum, p) => sum + (p.type === "refund" ? -p.amount : p.amount), 0)
    : 0
  const cashPaidAmount = Math.round((ledgerPaidAmount - creditAmount) * 100) / 100
  const displayedDueAmount = ledgerTotals?.dueAmount ?? order?.dueAmount ?? 0

  const [paymentMethod, setPaymentMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  // Raw text, not a number: starts empty and is never auto-filled from the
  // due amount — mirrors CheckoutPanel's own pattern.
  const [paymentAmount, setPaymentAmount] = useState("")
  const parsedPaymentAmount = Number(paymentAmount)
  const isValidPaymentAmount = paymentAmount.trim() !== "" && Number.isFinite(parsedPaymentAmount) && parsedPaymentAmount > 0
  const [creditCustomerId, setCreditCustomerId] = useState<number | undefined>(undefined)
  // Shown to the cashier while charging to a tab, so they can see the
  // customer's remaining headroom before it gets rejected server-side.
  const { data: creditAccount } = useCustomerCreditAccount(creditCustomerId ?? 0)
  const remainingCredit =
    creditAccount && creditAccount.creditLimit > 0
      ? Math.round((creditAccount.creditLimit - creditAccount.outstandingBalance) * 100) / 100
      : null

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

  const foodName = (foodId: number) => menu?.foods.find((f) => f.id === foodId)?.name ?? "Loading…"
  const variantName = (foodVariantId: number | null) =>
    foodVariantId ? (menu?.foodVariants.find((v) => v.id === foodVariantId)?.name ?? null) : null
  const serverPendingItems = items?.data.filter((item) => item.status === "stock_reserved") ?? []
  const sentItems = items?.data.filter((item) => item.status !== "stock_reserved") ?? []
  // Anything not yet 'served' (or voided) — including items still sitting in
  // the cart, never sent to kitchen. Purely informational for the main
  // Complete button (which passes autoServe, marking all of these served
  // rather than requiring the normal serve step first); still gates the
  // separate destructive "void instead" option, which needs orders.delete.
  // Mirrors CheckoutPanel's identical unservedItemCount.
  const unservedItemCount = (items?.data ?? []).filter(
    (item) => item.status !== "served" && item.status !== "cancelled",
  ).length
  const serverPendingCount = serverPendingItems.filter((item) => !item.isHeld).length
  const heldCount = serverPendingItems.filter((item) => item.isHeld).length
  const pendingCount = serverPendingCount + localCart.items.length
  const isPlacing = addItemsBatch.isPending || sendToKitchen.isPending

  async function handlePlaceOrder() {
    if (!isOnline) {
      toast.error("You're offline — reconnect to place the order")
      return
    }
    try {
      // Local cart items only ever touch the network here, as one batch
      // request, instead of one round-trip per add — see
      // orders.service#addItemsBatch.
      if (localCart.items.length > 0) {
        const createdItems = await addItemsBatch.mutateAsync({
          items: localCart.items.map((item) => ({
            foodId: item.foodId,
            foodVariantId: item.foodVariantId ?? undefined,
            quantity: item.quantity,
            note: item.note || undefined,
            packagingType: item.packagingType,
          })),
        })
        localCart.clear()
        await sendToKitchen.mutateAsync(createdItems.map((item) => item.id))
      } else {
        await sendToKitchen.mutateAsync(serverPendingItems.filter((item) => !item.isHeld).map((item) => item.id))
      }
      toast.success(`Placed ${pendingCount} item(s) — kitchen items sent to prep, the rest go straight to the waiter`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to place order")
    }
  }

  async function handlePlaceOrderOverride() {
    if (localCart.items.length > 0) {
      const createdItems = await addItemsBatchOverride.mutateAsync({ items: localCart.items.map((item) => ({ foodId: item.foodId, foodVariantId: item.foodVariantId ?? undefined, quantity: item.quantity, note: item.note || undefined, packagingType: item.packagingType })) })
      localCart.clear()
      await sendToKitchenOverride.mutateAsync(createdItems.map((item) => item.id))
    } else {
      await sendToKitchenOverride.mutateAsync(serverPendingItems.filter((item) => !item.isHeld).map((item) => item.id))
    }
    toast.success(`Placed ${pendingCount} item(s)`)
  }

  async function handleFireHeld() {
    if (!isOnline) {
      toast.error("You're offline — reconnect to send items to the kitchen")
      return
    }
    try {
      await fireHeld.mutateAsync()
      toast.success(`Fired ${heldCount} held item(s) to the kitchen`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fire held items")
    }
  }

  async function handleFireHeldOverride() {
    await fireHeldOverride.mutateAsync()
    toast.success(`Fired ${heldCount} held item(s) to the kitchen`)
  }

  async function handleCompleteSale() {
    if (!order) return
    if (!isOnline) {
      toast.error("You're offline — reconnect to complete the sale")
      return
    }
    try {
      // autoServe: a no-op once everything's served, so "Complete sale" just
      // works instead of stalling on "N items not yet served". Unlike force
      // (below) nothing leaves the bill — unserved items are marked served,
      // so the sale still charges and consumes stock for them normally.
      // Mirrors CheckoutPanel#handleCompleteSale.
      await updateStatus.mutateAsync({ status: "completed", autoServe: true })
      // Stay put instead of bouncing to the receipt page — the bill can be
      // printed from the button above whenever it's needed, before or after
      // completion — mirrors CheckoutPanel's own behavior.
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
    <div className="flex w-full flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">
      <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Cart</h2>
      <div className="max-h-[45vh] space-y-3 overflow-y-auto">
        {isLoading && <ListSkeleton count={3} />}
        {!isLoading &&
          pendingCount === 0 &&
          (canEditSentItems ? sentItems.length === 0 : waiterSentItems.length === 0) && (
            <p className="text-sm text-muted-foreground">No items yet — tap a food to add it.</p>
          )}
        {pendingCount > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">
              In cart — not sent yet ({pendingCount})
            </h3>
            {localCart.items.map((item) => (
              <LocalCartItemRow key={item.localId} item={item} />
            ))}
            {serverPendingItems.map((item) => (
              <CartItemRow
                key={item.id}
                orderId={orderId}
                item={item}
                foodName={foodName(item.foodId)}
                variantName={variantName(item.foodVariantId)}
                canCancelAfterServed={canRecordPayment}
              />
            ))}
          </div>
        )}
        {/* Everything already sent to the kitchen. A regular waiter sees
            every item for the table's whole visit (across every
            round/order), read-only — once an item is in the kitchen
            pipeline staff act on it from the KDS/tickets, not from here. A
            cashier/admin (matches the backend gate in
            OrderItemsController#update) instead gets the editable per-item
            rows for the current order, for correcting a mistake after the
            fact. Neither view combines repeat lines of the same food into
            one row — each order_item is its own line, with who ordered it
            and when. */}
        {canEditSentItems
          ? sentItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                  Placed order ({sentItems.length})
                </h3>
                {sentItems.map((item) => (
                  <SentItemRow
                    key={item.id}
                    orderId={orderId}
                    item={item}
                    foodName={foodName(item.foodId)}
                    variantName={variantName(item.foodVariantId)}
                    canCancelAfterServed={canRecordPayment}
                  />
                ))}
              </div>
            )
          : waiterSentItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                  Placed order ({waiterSentItems.length})
                </h3>
                {tableSessionItemsLoading && <ListSkeleton count={2} />}
                {waiterSentItems.map((item) => (
                  <ReadOnlySentItemRow
                    key={item.id}
                    item={item}
                    foodName={foodName(item.foodId)}
                    variantName={variantName(item.foodVariantId)}
                  />
                ))}
              </div>
            )}
      </div>
      {heldCount > 0 && (
        <>
        <Button
          variant="outline"
          className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          onClick={handleFireHeld}
          disabled={fireHeld.isPending || !isOnline}
        >
          <FlameIcon />
          {fireHeld.isPending ? "Firing..." : `Fire held items (${heldCount})`}
        </Button>
        <ClosedHoursOverrideButton closed={operatingHours?.enabled === true && operatingHours.isOpen === false} label="fire held items" onConfirm={handleFireHeldOverride} />
        </>
      )}
      <Button
        variant="secondary"
        onClick={handlePlaceOrder}
        disabled={pendingCount === 0 || isPlacing || !isOnline}
      >
        {isPlacing ? "Placing..." : `Place order${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
      </Button>
      <ClosedHoursOverrideButton closed={operatingHours?.enabled === true && operatingHours.isOpen === false} label="place order" onConfirm={handlePlaceOrderOverride} />
      </div>

      {/* Column 2: record a payment — nothing to do here without the
          permission, so this column is simply omitted rather than shown
          empty (see canRecordPayment above). */}
      {order && canRecordPayment && (
        <div className="space-y-2.5 rounded-lg border border-dashed border-input p-3">
          <div className="flex items-center gap-1.5">
            <CircleDollarSignIcon className="size-4 text-primary" />
            <h3 className="text-sm font-medium">Record payment</h3>
          </div>
          <OrderDiscountForm orderId={orderId} />
          <PaymentMethodPicker
            value={paymentMethod}
            onChange={(method) => {
              setPaymentMethod(method)
              if (method === "credit") setCreditCustomerId(order.customerId ?? undefined)
            }}
          />
          <div className="space-y-1">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
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
            <div className="space-y-1">
              <Label htmlFor="payment-credit-customer">Charge to</Label>
              <Select
                value={creditCustomerId ? String(creditCustomerId) : ""}
                onValueChange={(value) => setCreditCustomerId(value ? Number(value) : undefined)}
              >
                <SelectTrigger id="payment-credit-customer" className="w-full" disabled={customersLoading}>
                  <SelectValue placeholder={customersLoading ? "Loading…" : "Select a customer's tab"} />
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
            </div>
          )}
          {paymentMethod === "credit" && creditCustomerId && creditAccount && (
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/50 p-2 text-xs">
              <span className="text-muted-foreground">Current credit owed</span>
              <span className="text-right tabular-nums">{creditAccount.outstandingBalance}</span>
              <span className="text-muted-foreground">Credit limit</span>
              <span className="text-right tabular-nums">
                {creditAccount.creditLimit > 0 ? creditAccount.creditLimit : "None"}
              </span>
              <span className="font-medium">Remaining credit</span>
              <span
                className={`text-right font-medium tabular-nums ${
                  remainingCredit !== null && remainingCredit < parsedPaymentAmount ? "text-destructive" : ""
                }`}
              >
                {remainingCredit !== null ? remainingCredit : "Unlimited"}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleAddPayment}
            disabled={
              createPayment.isPending ||
              !isValidPaymentAmount ||
              !isOnline ||
              (paymentMethod === "credit" && !creditCustomerId) ||
              (paymentMethod === "credit" && remainingCredit !== null && parsedPaymentAmount > remainingCredit)
            }
          >
            {createPayment.isPending ? "Recording..." : "Add payment"}
          </Button>
          <ClosedHoursOverrideButton closed={operatingHours?.enabled === true && operatingHours.isOpen === false} label="add payment" onConfirm={async () => { await createPaymentOverride.mutateAsync({ type: "payment", method: paymentMethod, amount: parsedPaymentAmount, customerId: paymentMethod === "credit" ? creditCustomerId : undefined }); setPaymentAmount(""); toast.success("Payment recorded") }} />
        </div>
      )}

      {/* Column 3: payment summary (totals + ledger) and, for whoever can
          take money, the complete-sale actions. */}
      {order && (
          <div className="space-y-3 rounded-lg border border-input p-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <ReceiptIcon className="size-3.5" />
                Payment summary
              </h3>
              <BillReceiptDialog orderId={orderId} />
            </div>

            {/* Totals — Due is the one number that matters at a glance, so it's
                the only row pulled out of the muted list and colored. */}
            <div className="rounded-lg border border-input p-3">
              <div className="grid grid-cols-2 gap-y-1 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="text-right tabular-nums">{order.subtotal}</span>
                {order.discountAmount > 0 && (
                  <>
                    <span>Discount</span>
                    <span className="text-right tabular-nums">-{order.discountAmount}</span>
                  </>
                )}
                <span className="font-medium text-foreground">Grand total</span>
                <span className="text-right font-medium text-foreground tabular-nums">{order.grandTotal}</span>
                <span>Paid</span>
                <span className="text-right tabular-nums">{cashPaidAmount}</span>
                {creditAmount > 0 && (
                  <>
                    <span>On credit</span>
                    <span className="text-right tabular-nums">{creditAmount}</span>
                  </>
                )}
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{displayedDueAmount > 0 ? "Due" : "Status"}</span>
                {displayedDueAmount > 0 ? (
                  <span className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {displayedDueAmount}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2Icon className="size-4" />
                    Paid in full
                  </span>
                )}
              </div>
            </div>

            {(payments?.data.length ?? 0) > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Payment details</h4>
                <div className="divide-y divide-border rounded-lg border border-input">
                  {payments?.data.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>{payment.type}</Badge>
                        <span className="capitalize text-muted-foreground">{payment.method}</span>
                      </div>
                      <span className="font-medium tabular-nums">{payment.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canRecordPayment && (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCompleteSale}
                  disabled={displayedDueAmount > 0 || updateStatus.isPending || !isOnline}
                >
                  {!isOnline ? (
                    "Offline"
                  ) : displayedDueAmount > 0 ? (
                    `Due ${displayedDueAmount}`
                  ) : unservedItemCount > 0 ? (
                    `Complete sale (${unservedItemCount} unserved item${unservedItemCount === 1 ? "" : "s"} will auto-serve)`
                  ) : (
                    <>
                      <CheckCircle2Icon />
                      Complete sale
                    </>
                  )}
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
                          {unservedItemCount} item{unservedItemCount === 1 ? " hasn't" : "s haven't"} been served yet.
                          This drops {unservedItemCount === 1 ? "it" : "them"} from the bill entirely (releasing any
                          reserved stock) instead of charging for and serving{" "}
                          {unservedItemCount === 1 ? "it" : "them"} — use this only when the guest genuinely didn&apos;t
                          get {unservedItemCount === 1 ? "it" : "them"}. This cannot be undone.
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
                <ClosedHoursOverrideButton closed={operatingHours?.enabled === true && operatingHours.isOpen === false} label="complete sale" onConfirm={handleCompleteSaleOverride} />
              </>
            )}
          </div>
      )}
    </div>
  )
}

function CartItemRow({
  orderId,
  item,
  foodName,
  variantName,
  canCancelAfterServed,
}: {
  orderId: number
  item: OrderItem
  foodName: string
  variantName: string | null
  canCancelAfterServed: boolean
}) {
  const updateItem = useUpdateOrderItem(orderId, item.id)
  const removeItem = useRemoveOrderItem(orderId)
  const [note, setNote] = useState(item.note ?? "")

  async function handleQuantity(delta: number) {
    const quantity = Math.max(1, item.quantity + delta)
    try {
      await updateItem.mutateAsync({ quantity })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update quantity")
    }
  }

  async function handleNoteBlur() {
    if (note === (item.note ?? "")) return
    try {
      await updateItem.mutateAsync({ note })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save note")
    }
  }

  async function handleRemove() {
    try {
      await removeItem.mutateAsync(item.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove item")
    }
  }

  const isServed = item.status === "served"

  return (
    <div className="space-y-2 rounded-lg border border-input p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">
              {foodName}
              {variantName ? ` — ${variantName}` : ""}
            </p>
            {item.status === "stock_reserved" && item.isHeld ? (
              <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-700 dark:text-amber-400">
                Held
              </Badge>
            ) : item.status !== "stock_reserved" ? (
              <Badge variant="secondary" className="text-xs">
                {ITEM_STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            ) : null}
            {item.packagingType === "takeaway" && (
              <Badge variant="outline" className="border-sky-500/50 text-xs text-sky-700 dark:text-sky-400">
                Takeaway
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.unitPrice} each &middot; total {item.totalAmount}
          </p>
        </div>
        {item.status === "stock_reserved" && (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={updateItem.isPending}
            onClick={() =>
              updateItem.mutateAsync({ isHeld: !item.isHeld }).catch((error) => {
                toast.error(error instanceof Error ? error.message : "Failed to update item")
              })
            }
            aria-label={item.isHeld ? "Fire this item now" : "Hold this item"}
            title={item.isHeld ? "Fire now (send to kitchen)" : "Hold (don't send yet)"}
          >
            {item.isHeld ? <PlayIcon className="text-emerald-500" /> : <PauseIcon className="text-amber-500" />}
          </Button>
        )}
        {(!isServed || canCancelAfterServed) && (
          <Button variant="ghost" size="icon-sm" onClick={handleRemove} aria-label="Remove item">
            <XIcon />
          </Button>
        )}
      </div>

      {isServed ? (
        item.note && (
          <p className="text-xs text-muted-foreground">
            Qty {item.quantity} &middot; {item.note}
          </p>
        )
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-xs" onClick={() => handleQuantity(-1)} aria-label="Decrease quantity">
              <MinusIcon />
            </Button>
            <span className="w-6 text-center text-sm">{item.quantity}</span>
            <Button variant="outline" size="icon-xs" onClick={() => handleQuantity(1)} aria-label="Increase quantity">
              <PlusIcon />
            </Button>
          </div>

          {item.status === "stock_reserved" && (
            <div className="flex overflow-hidden rounded-md border border-input w-fit">
              <button
                type="button"
                disabled={updateItem.isPending}
                onClick={() =>
                  updateItem.mutateAsync({ packagingType: "plating" }).catch((error) => {
                    toast.error(error instanceof Error ? error.message : "Failed to update item")
                  })
                }
                className={`px-2 py-1 text-xs ${
                  item.packagingType === "plating" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Plating
              </button>
              <button
                type="button"
                disabled={updateItem.isPending}
                onClick={() =>
                  updateItem.mutateAsync({ packagingType: "takeaway" }).catch((error) => {
                    toast.error(error instanceof Error ? error.message : "Failed to update item")
                  })
                }
                className={`px-2 py-1 text-xs ${
                  item.packagingType === "takeaway" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Takeaway
              </button>
            </div>
          )}

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Special instructions..."
            className="text-xs"
          />
        </>
      )}
    </div>
  )
}

/** "HH:MM" in the viewer's local time — matches the kitchen page's clock formatting. */
function formatOrderedAt(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/**
 * One order_item row, its own line — never combined with a repeat of the
 * same food, so quantity/note/remove always act on exactly the line shown.
 */
function SentItemRow({
  orderId,
  item,
  foodName,
  variantName,
  canCancelAfterServed,
}: {
  orderId: number
  item: OrderItem
  foodName: string
  variantName: string | null
  canCancelAfterServed: boolean
}) {
  const updateItem = useUpdateOrderItem(orderId, item.id)
  const removeItem = useRemoveOrderItem(orderId)
  const [note, setNote] = useState(item.note ?? "")

  async function handleQuantity(delta: number) {
    const quantity = Math.max(1, item.quantity + delta)
    try {
      await updateItem.mutateAsync({ quantity })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update quantity")
    }
  }

  async function handleNoteBlur() {
    if (note === (item.note ?? "")) return
    try {
      await updateItem.mutateAsync({ note })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save note")
    }
  }

  async function handleRemove() {
    try {
      await removeItem.mutateAsync(item.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove item")
    }
  }

  const isServed = item.status === "served"

  return (
    <div className="space-y-2 rounded-lg border border-input p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">
              {foodName}
              {variantName ? ` — ${variantName}` : ""}
            </p>
            <Badge variant="secondary" className="text-xs">
              {ITEM_STATUS_LABELS[item.status] ?? item.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.unitPrice} each &middot; total {item.totalAmount}
          </p>
          <p className="text-xs text-muted-foreground">
            Ordered by {item.createdByName} &middot; ordered at {formatOrderedAt(item.createdAt)}
          </p>
        </div>
        {(!isServed || canCancelAfterServed) && (
          <Button variant="ghost" size="icon-sm" onClick={handleRemove} aria-label="Remove item">
            <XIcon />
          </Button>
        )}
      </div>

      {isServed ? (
        item.note && (
          <p className="text-xs text-muted-foreground">
            Qty {item.quantity} &middot; {item.note}
          </p>
        )
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-xs" onClick={() => handleQuantity(-1)} aria-label="Decrease quantity">
              <MinusIcon />
            </Button>
            <span className="w-6 text-center text-sm">{item.quantity}</span>
            <Button variant="outline" size="icon-xs" onClick={() => handleQuantity(1)} aria-label="Increase quantity">
              <PlusIcon />
            </Button>
          </div>

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Special instructions..."
            className="text-xs"
          />
        </>
      )}
    </div>
  )
}

/**
 * Read-only counterpart to SentItemRow for a waiter tracking a table's whole
 * visit — once an item is in the kitchen pipeline it's edited from the
 * KDS/tickets screens, not from here. Same one-line-per-order_item shape as
 * the editable view, just without the quantity/note/remove controls.
 */
function ReadOnlySentItemRow({
  item,
  foodName,
  variantName,
}: {
  item: OrderItem
  foodName: string
  variantName: string | null
}) {
  return (
    <div className="space-y-1 rounded-lg border border-input p-2.5">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium">
          {foodName}
          {variantName ? ` — ${variantName}` : ""}
        </p>
        <Badge variant="secondary" className="text-xs">
          {ITEM_STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Qty {item.quantity} &middot; {item.unitPrice} each
        {item.note ? ` · ${item.note}` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Ordered by {item.createdByName} &middot; ordered at {formatOrderedAt(item.createdAt)}
      </p>
    </div>
  )
}

/** Not-yet-placed item — every edit here is local state, nothing hits the network until "Place order". */
function LocalCartItemRow({ item }: { item: LocalCartItem }) {
  const localCart = useLocalCartContext()

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-input p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">
              {item.foodName}
              {item.variantName ? ` — ${item.variantName}` : ""}
            </p>
            <Badge variant="outline" className="text-xs">
              Not sent
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.unitPrice} each &middot; total {(item.unitPrice * item.quantity).toFixed(2)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => localCart.removeItem(item.localId)}
          aria-label="Remove item"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => localCart.updateQuantity(item.localId, item.quantity - 1)}
          aria-label="Decrease quantity"
        >
          <MinusIcon />
        </Button>
        <span className="w-6 text-center text-sm">{item.quantity}</span>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => localCart.updateQuantity(item.localId, item.quantity + 1)}
          aria-label="Increase quantity"
        >
          <PlusIcon />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex overflow-hidden rounded-md border border-input">
          <button
            type="button"
            onClick={() => localCart.updatePackagingType(item.localId, "plating")}
            className={`px-2 py-1 text-xs ${
              item.packagingType === "plating" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Plating
          </button>
          <button
            type="button"
            onClick={() => localCart.updatePackagingType(item.localId, "takeaway")}
            className={`px-2 py-1 text-xs ${
              item.packagingType === "takeaway" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Takeaway
          </button>
        </div>
        {item.quantity > 1 && (
          <button
            type="button"
            onClick={() => localCart.splitPackaging(item.localId, Math.floor(item.quantity / 2))}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            title={`Split into ${Math.floor(item.quantity / 2)} ${
              item.packagingType === "takeaway" ? "plating" : "takeaway"
            } + ${item.quantity - Math.floor(item.quantity / 2)} ${item.packagingType}`}
          >
            Split half/half
          </button>
        )}
      </div>

      <Input
        value={item.note}
        onChange={(e) => localCart.updateNote(item.localId, e.target.value)}
        placeholder="Special instructions..."
        className="text-xs"
      />
    </div>
  )
}

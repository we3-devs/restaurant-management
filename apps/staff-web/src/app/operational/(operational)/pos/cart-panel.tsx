"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FlameIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, PrinterIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { useCurrentUser } from "@rms/auth/current-user-context"
import { Badge } from "@rms/ui/badge"
import { BillSummary } from "@rms/ui/bill-summary"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { OrderDiscountForm } from "@rms/ui/order-discount-form"
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
  // The receipt page and the tables board are their own top-level
  // staff-shell pages (see staff/nav-items.ts), not nested under basePath.
  const isStaffShell = basePath.startsWith("/operational/staff")
  const receiptPath = isStaffShell ? `/operational/staff/pos/receipt/${orderId}` : `/operational/pos/receipt/${orderId}`
  const tablesPath = isStaffShell ? "/operational/staff/waiter/tables" : "/operational/floor"
  const { data: order } = useOrder(orderId)

  // Nothing left to do once the sale is closed out — items can no longer be
  // edited and payment is done, so collapse to a read-only summary instead
  // of the full editable cart.
  if (order?.status === "completed") {
    return <CompletedSaleSummary order={order} receiptPath={receiptPath} tablesPath={tablesPath} />
  }

  return <EditableCart orderId={orderId} receiptPath={receiptPath} />
}

function CompletedSaleSummary({
  order,
  receiptPath,
  tablesPath,
}: {
  order: Order
  receiptPath: string
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
      <Button variant="outline" render={<Link href={receiptPath} target="_blank" rel="noopener noreferrer" />}>
        <PrinterIcon />
        View / print bill
      </Button>
      <Button onClick={() => router.replace(tablesPath)}>Go to tables</Button>
    </div>
  )
}

function EditableCart({
  orderId,
  receiptPath,
}: {
  orderId: number
  receiptPath: string
}) {
  const { data: items, isLoading } = useOrderItems(orderId)
  const { data: order } = useOrder(orderId)
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
  const canRecordPayment = user.isSuperadmin || user.roleSlugs.includes("cashier")
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
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [creditCustomerId, setCreditCustomerId] = useState<number | undefined>(undefined)
  // Shown to the cashier while charging to a tab, so they can see the
  // customer's remaining headroom before it gets rejected server-side.
  const { data: creditAccount } = useCustomerCreditAccount(creditCustomerId ?? 0)
  const remainingCredit =
    creditAccount && creditAccount.creditLimit > 0
      ? Math.round((creditAccount.creditLimit - creditAccount.outstandingBalance) * 100) / 100
      : null

  // Re-seed the payment amount whenever the due amount changes (order loads,
  // or a payment lands) — without an effect, per React's "adjusting state
  // when a prop changes" pattern.
  const [seededDueAmount, setSeededDueAmount] = useState<number | null>(null)
  if (order && displayedDueAmount !== seededDueAmount) {
    setSeededDueAmount(displayedDueAmount)
    setPaymentAmount(displayedDueAmount)
  }

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

  const foodName = (foodId: number) => menu?.foods.find((f) => f.id === foodId)?.name ?? "Loading…"
  const variantName = (foodVariantId: number | null) =>
    foodVariantId ? (menu?.foodVariants.find((v) => v.id === foodVariantId)?.name ?? null) : null
  const serverPendingItems = items?.data.filter((item) => item.status === "stock_reserved") ?? []
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
      await updateStatus.mutateAsync("completed")
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
    await updateStatusOverride.mutateAsync("completed")
    toast.success(order.subtotal === 0 ? "Table closed — no sale" : "Sale complete")
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="text-sm font-semibold">Cart</h2>
      <div className="max-h-[45vh] space-y-2 overflow-y-auto">
        {isLoading && <ListSkeleton count={3} />}
        {!isLoading && (items?.data.length ?? 0) === 0 && localCart.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No items yet — tap a food to add it.</p>
        )}
        {localCart.items.map((item) => (
          <LocalCartItemRow key={item.localId} item={item} />
        ))}
        {items?.data.map((item) => (
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
      {order && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Payment info</h3>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={receiptPath} target="_blank" rel="noopener noreferrer" />}
              >
                <PrinterIcon />
                View / print bill
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-right">{order.subtotal}</span>
              <span className="text-muted-foreground">Discount</span>
              <span className="text-right">{order.discountAmount}</span>
              <span className="font-medium">Grand total</span>
              <span className="text-right font-medium">{order.grandTotal}</span>
              <span className="text-muted-foreground">Paid</span>
              <span className="text-right">{cashPaidAmount}</span>
              {creditAmount > 0 && (
                <>
                  <span className="text-muted-foreground">Credit</span>
                  <span className="text-right">{creditAmount}</span>
                </>
              )}
              <span className="font-medium">Due</span>
              <span className="text-right font-medium">{displayedDueAmount}</span>
            </div>
            {canRecordPayment && <OrderDiscountForm orderId={orderId} />}
            {(payments?.data.length ?? 0) > 0 && (
              <div className="space-y-1 pt-1">
                {payments?.data.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>{payment.type}</Badge>
                      <span>{payment.method}</span>
                    </div>
                    <span>{payment.amount}</span>
                  </div>
                ))}
              </div>
            )}

            {canRecordPayment && (
              <>
                <div className="grid grid-cols-2 gap-2 pt-2">
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
                {paymentMethod === "credit" && creditCustomerId && creditAccount && (
                  <div className="grid grid-cols-2 gap-1 rounded-md border border-input p-2 text-xs">
                    <span className="text-muted-foreground">Current credit owed</span>
                    <span className="text-right">{creditAccount.outstandingBalance}</span>
                    <span className="text-muted-foreground">Credit limit</span>
                    <span className="text-right">{creditAccount.creditLimit > 0 ? creditAccount.creditLimit : "None"}</span>
                    <span className="font-medium">Remaining credit</span>
                    <span
                      className={`text-right font-medium ${
                        remainingCredit !== null && remainingCredit < paymentAmount ? "text-destructive" : ""
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
                    paymentAmount <= 0 ||
                    !isOnline ||
                    (paymentMethod === "credit" && !creditCustomerId) ||
                    (paymentMethod === "credit" && remainingCredit !== null && paymentAmount > remainingCredit)
                  }
                >
                  {createPayment.isPending ? "Recording..." : "Add payment"}
                </Button>
                <ClosedHoursOverrideButton closed={operatingHours?.enabled === true && operatingHours.isOpen === false} label="add payment" onConfirm={async () => { await createPaymentOverride.mutateAsync({ type: "payment", method: paymentMethod, amount: paymentAmount, customerId: paymentMethod === "credit" ? creditCustomerId : undefined }); toast.success("Payment recorded") }} />
                <Button
                  className="w-full"
                  onClick={handleCompleteSale}
                  disabled={displayedDueAmount > 0 || serverPendingItems.length > 0 || updateStatus.isPending || !isOnline}
                >
                  {!isOnline
                    ? "Offline"
                    : displayedDueAmount > 0
                      ? `Due ${displayedDueAmount}`
                      : serverPendingItems.length > 0
                        ? `Send ${serverPendingItems.length} item${serverPendingItems.length === 1 ? "" : "s"} to kitchen first`
                        : "Complete sale"}
                </Button>
                <ClosedHoursOverrideButton closed={operatingHours?.enabled === true && operatingHours.isOpen === false} label="complete sale" onConfirm={handleCompleteSaleOverride} />
              </>
            )}
          </div>
        </>
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

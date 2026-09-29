"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { BillReceipt } from "@/components/bill-receipt"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PaymentMethodPicker } from "@/components/ui/payment-method-picker"
import { ReceiptPrintButton } from "@/components/ui/receipt-print"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useOrder, useOrderItems, type Order, type OrderItem } from "@/hooks/use-orders"
import { useOrderAssignments } from "@/lib/api/hooks/use-assignments"
import { useCreateOrderPayment } from "@/hooks/use-order-payments"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { ORDER_PAYMENT_METHODS } from "@/lib/validators/orders"
import { useFoods } from "@/hooks/use-foods"
import { useFoodVariants } from "@/hooks/use-food-variants"
import { useCustomer } from "@/hooks/use-customers"
import { useDiningTable } from "@/hooks/use-dining-tables"
import { useTableSession } from "@/hooks/use-table-sessions"
import { formatTime } from "@/features/kitchen/ticket-stage"
import { usePageTitle } from "@rms/ui/use-page-title"

function Breadcrumb({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Link href="/dashboard/dashboard" className="hover:text-foreground">
        Home
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <Link href="/dashboard/overview/orders" className="hover:text-foreground">
        Orders
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <span className="text-primary">{orderNumber}</span>
    </div>
  )
}
/*/////////
/** Order tracking for admin — item status alongside the bill (printable, refundable once paid). Editing and taking payments stay in operational/POS. */
export function OrderTrackingDetail({ orderId }: { orderId: number }) {
  const { data: order, isLoading } = useOrder(orderId)
  const { data: customer } = useCustomer(order?.customerId ?? 0)
  const { data: tableSession } = useTableSession(order?.tableSessionId ?? 0)
  const { data: table } = useDiningTable(tableSession?.diningTableId ?? 0)
  const customerNames = tableSession?.customers?.map((entry) => entry.name).filter(Boolean) ?? []
  const { data: assignments } = useOrderAssignments(orderId)
  const showSkeleton = useDelayedLoading(isLoading)

  usePageTitle("Order Details")

  if (showSkeleton) return <DetailPageSkeleton fields={6} />
  if (!isLoading && !order) return <NotFoundCard resource="Order" />
  if (!order) return null

  return (
    <div className="space-y-4">
      <Breadcrumb orderNumber={order.orderNumber} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{customerNames.length > 0 ? customerNames.join(", ") : customer?.name ?? "Walk-in customer"}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {order.orderSource.replace(/_/g, " ")} &middot; {table?.name ?? "No table"}
          </p>
          <p className="text-xs text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} />
          {order.invoiceNumber && (
            <Button variant="outline" size="sm" render={<Link href={`/dashboard/overview/invoices/${orderId}`} />}>
              View Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <OrderItemTracking orderId={orderId} />

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <ReceiptPrintButton orderId={orderId} />
            <RefundButton order={order} />
          </CardHeader>
          <CardContent>
            <BillReceipt orderId={orderId} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Per-item kitchen status — the bill only shows price lines, never where an item actually is in the kitchen workflow. */
function OrderItemTracking({ orderId }: { orderId: number }) {
  const { data: items, isLoading } = useOrderItems(orderId)
  const { data: foods } = useFoods({ limit: 500 })
  const { data: variants } = useFoodVariants({ limit: 500 })
  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? "Loading…"
  const variantName = (foodVariantId: number | null) =>
    foodVariantId ? (variants?.data.find((v) => v.id === foodVariantId)?.name ?? null) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Order Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading items…</p>}
        {!isLoading && (items?.data.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No items on this order yet.</p>
        )}
        {items?.data.map((item: OrderItem) => {
          // updatedAt tracks the last status change (sent → preparing → ready →
          // served). Only surface it once it diverges from the order time, so a
          // freshly-added item reads "Ordered …" instead of "Ordered X · X".
          const statusMovedAt =
            new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime() > 60_000
              ? formatTime(item.updatedAt)
              : null
          return (
            <div key={item.id} className="flex items-center justify-between gap-2 border-b border-input py-2 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.quantity} &times; {variantName(item.foodVariantId) ? `${variantName(item.foodVariantId)}` : `${foodName(item.foodId)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ordered by {item.createdByName} at {formatTime(item.createdAt)}
                  {statusMovedAt ? ` · updated ${statusMovedAt}` : ""}
                </p>
                {item.isHeld && <p className="text-xs text-muted-foreground">Held — not fired to kitchen</p>}
                {item.note && <p className="truncate text-xs text-muted-foreground">{item.note}</p>}
              </div>
              <StatusBadge status={item.status} />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/** Refund against a paid bill — up to what's still paid, since paidAmount is already net of earlier refunds. */
function RefundButton({ order }: { order: Order }) {
  const { permissions } = useCurrentUser()
  const createPayment = useCreateOrderPayment(order.id)
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState("")

  if (!permissions.includes("order-payments.refund") || order.paidAmount <= 0) return null

  const isValid = amount > 0 && amount <= order.paidAmount && reason.trim() !== ""

  async function handleSubmit() {
    if (!isValid) return
    try {
      await createPayment.mutateAsync({ type: "refund", method, amount, note: reason.trim() })
      toast.success("Refund recorded")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record refund")
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          setMethod("cash")
          setAmount(order.paidAmount)
          setReason("")
          setOpen(true)
        }}
      >
        Refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Refund {order.billNumber ?? order.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Credit is a customer's tab, not a refundable-from method. */}
            <PaymentMethodPicker value={method} onChange={setMethod} exclude={["credit"]} />
            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">Amount (up to {order.paidAmount})</Label>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min={0}
                max={order.paidAmount}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">Reason for refund</Label>
              <Input
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Guest complaint — food quality"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!isValid || createPayment.isPending} onClick={handleSubmit}>
              {createPayment.isPending ? "Saving..." : "Record refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

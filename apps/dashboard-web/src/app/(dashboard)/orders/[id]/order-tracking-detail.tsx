"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { BillReceipt } from "@/components/bill-receipt"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useOrder, useOrderItems, useIssueInvoice, type OrderItem } from "@/hooks/use-orders"
import { useOrderPayments } from "@/hooks/use-order-payments"
import { useOrderStatusHistory } from "@/hooks/use-orders"
import { useFoods } from "@/hooks/use-foods"
import { useFoodVariants } from "@/hooks/use-food-variants"
import { formatTime } from "@/features/kitchen/ticket-stage"
import { usePageTitle } from "@rms/ui/use-page-title"

function Breadcrumb({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Link href="/dashboard" className="hover:text-foreground">
        Home
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <Link href="/orders" className="hover:text-foreground">
        Orders
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <span className="text-primary">{orderNumber}</span>
    </div>
  )
}

/** Read-only order tracking for admin — bill, payment totals, and status history, no editing/payment actions (those stay in operational-web/POS). */
export function OrderTrackingDetail({ orderId }: { orderId: number }) {
  const { data: order, isLoading } = useOrder(orderId)
  const showSkeleton = useDelayedLoading(isLoading)
  const issueInvoice = useIssueInvoice(orderId)

  usePageTitle("Order Details")

  if (showSkeleton) return <DetailPageSkeleton fields={6} />
  if (!isLoading && !order) return <NotFoundCard resource="Order" />
  if (!order) return null

  return (
    <div className="space-y-4">
      <Breadcrumb orderNumber={order.orderNumber} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {order.orderType.replace(/_/g, " ")} &middot; {order.source.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} />
          {order.invoiceNumber ? (
            <Button variant="outline" size="sm" render={<Link href={`/invoices/${orderId}`} />}>
              View Invoice
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={issueInvoice.isPending}
              onClick={() => {
                issueInvoice.mutate(undefined, {
                  onSuccess: () => toast.success("Invoice generated successfully"),
                  onError: (error) => toast.error(`Failed to generate invoice: ${error.message}`),
                })
              }}
            >
              {issueInvoice.isPending ? "Generating..." : "Issue Invoice"}
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        <OrderItemTracking orderId={orderId} />
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader />
          <CardContent>
            <BillReceipt orderId={orderId} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <PaymentSummary orderId={orderId} order={order} />
          <StatusHistory orderId={orderId} />
        </div>
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
                  {item.quantity} &times; {foodName(item.foodId)}
                  {variantName(item.foodVariantId) ? ` — ${variantName(item.foodVariantId)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ordered {formatTime(item.createdAt)}
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

function PaymentSummary({
  orderId,
  order,
}: {
  orderId: number
  order: {
    subtotal: number
    discountAmount: number
    grandTotal: number
    paidAmount: number
    dueAmount: number
    refundedAmount: number
  }
}) {
  const { data: payments } = useOrderPayments(orderId)

  return (
    <Card>
      <CardHeader className="text-sm font-medium">Payment summary</CardHeader>
      <CardContent className="space-y-4">
        {payments && payments.data.length > 0 && (
          <div className="space-y-1 border-t border-b border-input py-4">
            {payments.data.map((payment) => (
              <div key={payment.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">
                  {payment.type} &middot; {payment.method}
                </span>
                <span className={payment.type === "refund" ? "text-destructive" : ""}>{payment.amount}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
          <span className="text-muted-foreground">Subtotal :</span>
          <span className="text-right sm:text-left">{order.subtotal}</span>
          <span className="text-muted-foreground">Discount :</span>
          <span className="text-right sm:text-left">{order.discountAmount}</span>
          <span className="font-medium">Grand Total :</span>
          <span className="text-right font-medium sm:text-left">{order.grandTotal}</span>
          <span className="text-muted-foreground">Paid :</span>
          <span className="text-right text-emerald-500 sm:text-left">{order.paidAmount}</span>
          <span className="font-medium">Due :</span>
          <span className="text-right font-medium text-destructive sm:text-left">{order.dueAmount}</span>
          <span className="text-muted-foreground">Refunded :</span>
          <span className="text-right sm:text-left">{order.refundedAmount}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusHistory({ orderId }: { orderId: number }) {
  const { data: history } = useOrderStatusHistory(orderId)

  if (!history || history.length === 0) return null

  return (
    <Card>
      <CardHeader className="text-sm font-medium">Status history</CardHeader>
      <CardContent className="space-y-2">
        {history.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between text-sm">
            <span className="capitalize text-muted-foreground">
              {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : entry.toStatus}
            </span>
            <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

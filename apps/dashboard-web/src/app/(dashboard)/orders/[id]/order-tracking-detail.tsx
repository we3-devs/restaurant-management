"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { BillReceipt } from "@/components/bill-receipt"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useOrder } from "@/hooks/use-orders"
import { useOrderPayments } from "@/hooks/use-order-payments"
import { useOrderStatusHistory } from "@/hooks/use-orders"

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
        </div>
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

function PaymentSummary({
  orderId,
  order,
}: {
  orderId: number
  order: {
    subtotal: number
    discountAmount: number
    taxAmount: number
    serviceChargeAmount: number
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
          <span className="text-muted-foreground">Tax :</span>
          <span className="text-right sm:text-left">{order.taxAmount}</span>
          <span className="text-muted-foreground">Service charge :</span>
          <span className="text-right sm:text-left">{order.serviceChargeAmount}</span>
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

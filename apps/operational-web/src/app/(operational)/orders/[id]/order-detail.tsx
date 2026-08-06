"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@rms/ui/status-badge"
import { BillReceipt } from "@rms/ui/bill-receipt"
import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Separator } from "@rms/ui/separator"
import { Skeleton } from "@rms/ui/skeleton"
import { useCreateOrderPayment, useOrderPayments } from "@rms/api-client/hooks/use-order-payments"
import { useOrder, useUpdateOrder, type Order } from "@rms/api-client/hooks/use-orders"
import { ORDER_DISCOUNT_TYPES, ORDER_PAYMENT_METHODS } from "@rms/validators/orders"

function Breadcrumb({ orderNumber, basePath }: { orderNumber: string; basePath: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Link href={basePath || "/"} className="hover:text-foreground">
        Home
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <Link href={`${basePath}/orders`} className="hover:text-foreground">
        Orders
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <span className="text-primary">{orderNumber}</span>
    </div>
  )
}

/**
 * Deliberately just two cards — bill and payment, nothing else. Order
 * details/customer/dining table/history/audit all got cut; anything about
 * items or the order itself is read from the bill on the left, and
 * everything actionable (recording a payment or refund) lives in the form
 * on the right.
 *
 * Shared between (operational)/orders/[id] (desktop sidebar shell) and
 * staff/orders/[id] (mobile shell) — basePath keeps every internal link
 * (breadcrumb, receipt) inside whichever shell rendered it instead of
 * always bouncing into the desktop one.
 */
export function OrderDetail({ orderId, basePath = "" }: { orderId: number; basePath?: string }) {
  const { data: order, isLoading } = useOrder(orderId)
  const [editingTotals, setEditingTotals] = useState(false)

  if (isLoading || !order) {
    return <Skeleton className="mx-auto h-96 w-full max-w-5xl" />
  }

  return (
    <div className=" space-y-4">
      <Breadcrumb orderNumber={order.orderNumber} basePath={basePath} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {order.orderType.replace(/_/g, " ")} &middot; {order.source.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <Button variant="outline" size="sm" render={<Link href={`${basePath}/pos/receipt/${orderId}`} />}>
            POS Bill
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`${basePath}/pos/receipt/${orderId}`} />}>
            Invoice
          </Button>
          {order.status !== "completed" && (
            <Button variant="outline" size="sm" onClick={() => setEditingTotals((v) => !v)}>
              {editingTotals ? "Done editing" : "Edit"}
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-2">
        <BillCard orderId={orderId} />
        <PaymentSummaryCard orderId={orderId} order={order} editingTotals={editingTotals} />
      </div>
    </div>
  )
}

function BillCard({ orderId }: { orderId: number }) {
  return (
    <Card>
      <CardHeader>
      </CardHeader>
      <CardContent>
        <BillReceipt orderId={orderId} />
      </CardContent>
    </Card>
  )
}

function PaymentSummaryCard({
  orderId,
  order,
  editingTotals,
}: {
  orderId: number
  order: Order
  editingTotals: boolean
}) {
  const createPayment = useCreateOrderPayment(orderId)
  const updateOrder = useUpdateOrder(orderId)
  const { data: payments } = useOrderPayments(orderId)

  const [method, setMethod] = useState<(typeof ORDER_PAYMENT_METHODS)[number]>("cash")
  const [amount, setAmount] = useState(0)
  const [formMode, setFormMode] = useState<"none" | "payment" | "refund">("none")
  // Re-seeds the amount field to the current due whenever it changes (e.g.
  // after a payment lands), without needing an effect.
  const [seededDue, setSeededDue] = useState<number | null>(null)
  if (order.dueAmount !== seededDue) {
    setSeededDue(order.dueAmount)
    setAmount(order.dueAmount)
  }

  const [discountType, setDiscountType] = useState<string>("none")
  const [discountValue, setDiscountValue] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [serviceChargeAmount, setServiceChargeAmount] = useState(0)
  const [seededOrderId, setSeededOrderId] = useState<number | null>(null)
  if (order.id !== seededOrderId) {
    setSeededOrderId(order.id)
    setDiscountType(order.discountType ?? "none")
    setDiscountValue(order.discountValue)
    setTaxAmount(order.taxAmount)
    setServiceChargeAmount(order.serviceChargeAmount)
  }

  const isLocked = order.status === "completed"

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

  async function handleSubmitPayment() {
    if (amount <= 0) return
    try {
      await createPayment.mutateAsync({ type: formMode === "refund" ? "refund" : "payment", method, amount })
      toast.success(formMode === "refund" ? "Refund recorded" : "Payment recorded")
      setFormMode("none")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row w-full items-center">
        <div className=" w-full flex items-center justify-between ">
          <StatusBadge status={order.paymentStatus} />
        {!isLocked && (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-red-600 border-red-600 text-white hover:bg-red-700"
              onClick={() => {
                setFormMode("refund")
                setAmount(order.paidAmount)
              }}
            >
              Refund
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setFormMode("payment")
                setAmount(order.dueAmount)
              }}
            >
              Add Payment
            </Button>
          </div>
        )}
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col space-y-4">
        {editingTotals && !isLocked && (
          <div className="space-y-2 border-b border-input  py-4">
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

        {formMode !== "none" && (
          <div className="space-y-2">
            <p className="text-sm font-medium capitalize">{formMode}</p>
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
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant={formMode === "refund" ? "destructive" : "default"}
                onClick={handleSubmitPayment}
                disabled={createPayment.isPending || amount <= 0}
              >
                {createPayment.isPending ? "Saving..." : formMode === "refund" ? "Record refund" : "Record payment"}
              </Button>
              <Button variant="outline" onClick={() => setFormMode("none")}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {payments && payments.data.length > 0 && (
          <div className="mt-auto space-y-1  border-b border-t border-input py-4">
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

        <div className=" grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
          <span className="text-muted-foreground">Subtotal :</span>
          <span className="text-right sm:text-left">{order.subtotal}</span>
          <span className="text-muted-foreground">Discount  :</span>
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

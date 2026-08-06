"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { StatusBadge } from "@rms/ui/status-badge"
import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Separator } from "@rms/ui/separator"
import { Skeleton } from "@rms/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rms/ui/table"
import { useCustomer, useCustomerOutlets } from "@rms/api-client/hooks/use-customers"
import { useLoyaltyAccount } from "@rms/api-client/hooks/use-loyalty"
import { useOutlet } from "@rms/api-client/hooks/use-outlets"
import { useOutletDepartments } from "@rms/api-client/hooks/use-outlet-departments"
import { useTableSession } from "@rms/api-client/hooks/use-table-sessions"
import { useUser } from "@rms/api-client/hooks/use-users"
import { useFoods } from "@rms/api-client/hooks/use-foods"
import { useCreateOrderPayment, useOrderPayments, type OrderPayment } from "@rms/api-client/hooks/use-order-payments"
import {
  useOrder,
  useOrderItems,
  useOrderStatusHistory,
  useUpdateOrder,
  type Order,
} from "@rms/api-client/hooks/use-orders"
import { ORDER_DISCOUNT_TYPES, ORDER_PAYMENT_METHODS } from "@rms/validators/orders"

function Breadcrumb({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Link href="/" className="hover:text-foreground">
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

/**
 * Billing (discount/tax/service charge, recording payments/refunds) stays
 * editable here, since that's a normal thing to do while looking at an
 * order's bill. Items and table assignment are read-only — both are
 * changed from POS/kitchen instead.
 */
export function OrderDetail({ orderId }: { orderId: number }) {
  const { data: order, isLoading } = useOrder(orderId)
  const [editingTotals, setEditingTotals] = useState(false)

  if (isLoading || !order) {
    return <Skeleton className="h-96 w-full max-w-5xl" />
  }

  return (
    <div className="max-w-5xl space-y-4">
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
          <Button variant="outline" size="sm" render={<Link href={`/pos/receipt/${orderId}`} />}>
            POS Bill
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/pos/receipt/${orderId}`} />}>
            Invoice
          </Button>
          {order.status !== "completed" && (
            <Button variant="outline" size="sm" onClick={() => setEditingTotals((v) => !v)}>
              {editingTotals ? "Done editing" : "Edit"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OrderDetailsCard order={order} />
        <CustomerCard customerId={order.customerId} outletId={order.outletId} />
      </div>

      {order.tableSessionId && <DiningTablesCard tableSessionId={order.tableSessionId} />}

      <OrderItemsCard orderId={orderId} outletId={order.outletId} />

      <PaymentSummaryCard orderId={orderId} order={order} editingTotals={editingTotals} />

      <PaymentHistoryCard orderId={orderId} />

      <StatusHistoryCard orderId={orderId} />

      <AuditCard order={order} />
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </>
  )
}

function OrderDetailsCard({ order }: { order: Order }) {
  const { data: outlet } = useOutlet(order.outletId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Details</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-y-2.5">
        <DetailRow label="Order Number" value={<span className="font-mono">{order.orderNumber}</span>} />
        <DetailRow label="Type" value={<span className="capitalize">{order.orderType.replace(/_/g, " ")}</span>} />
        <DetailRow label="Source" value={<span className="capitalize">{order.source.replace(/_/g, " ")}</span>} />
        <DetailRow label="Outlet" value={outlet?.name ?? "—"} />
        <DetailRow label="Ordered At" value={new Date(order.createdAt).toLocaleString()} />
      </CardContent>
    </Card>
  )
}

/** Shown even with no customer attached (dine-in walk-ins) — matches the reference's always-visible "-" placeholders. */
function CustomerCard({ customerId, outletId }: { customerId: number | null; outletId: number }) {
  const { data: customer } = useCustomer(customerId ?? 0)
  const { data: loyalty } = useLoyaltyAccount(customerId ?? 0)
  const { data: outlets } = useCustomerOutlets(customerId ?? 0)
  const visitCount = outlets?.find((visit) => visit.outletId === outletId)?.visitCount

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-y-2.5">
        <DetailRow label="Name" value={customer?.name ?? "—"} />
        <DetailRow label="Phone" value={customer?.phone ?? "—"} />
        <DetailRow label="Email" value={customer?.email ?? "—"} />
        {customerId && (
          <>
            <DetailRow label="Loyalty Points" value={loyalty?.currentPoints ?? 0} />
            <DetailRow label="Visits At This Outlet" value={visitCount ?? 0} />
          </>
        )}
        {customerId && (
          <Link
            href={`/customers/${customerId}`}
            className="col-span-2 mt-1 text-sm text-primary hover:underline"
          >
            View customer profile
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

/** Single-table model — Order -> TableSession -> one DiningTable (no per-table assignment history is tracked yet). */
function DiningTablesCard({ tableSessionId }: { tableSessionId: number }) {
  const { data: session } = useTableSession(tableSessionId)
  if (!session?.diningTableName) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dining Tables</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge className="text-sm">{session.diningTableName}</Badge>
      </CardContent>
    </Card>
  )
}

function OrderItemsCard({ orderId, outletId }: { orderId: number; outletId: number }) {
  const { data: items, isLoading } = useOrderItems(orderId)
  const { data: foods } = useFoods({ limit: 100 })
  const { data: departments } = useOutletDepartments({ outletId, limit: 100 })

  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`
  const departmentName = (id: number | null) =>
    id ? (departments?.data.find((d) => d.id === id)?.name ?? null) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && (items?.data.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No items on this order.</p>
        )}
        {items?.data.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 border-b border-input pb-3 last:border-0 last:pb-0">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{foodName(item.foodId)}</span>
                <StatusBadge status={item.status} />
                {departmentName(item.preparationDepartmentId) && (
                  <Badge variant="secondary">{departmentName(item.preparationDepartmentId)}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Qty: {item.quantity.toFixed(2)} @ {item.unitPrice}
              </p>
            </div>
            <span className="text-sm font-medium">Total: {item.totalAmount}</span>
          </div>
        ))}
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
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Payment Summary</CardTitle>
          <StatusBadge status={order.paymentStatus} />
        </div>
        {!isLocked && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setFormMode("payment")
                setAmount(order.dueAmount)
              }}
            >
              Add Payment
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setFormMode("refund")
                setAmount(order.paidAmount)
              }}
            >
              Refund
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-right sm:text-left">{order.subtotal}</span>
          <span className="text-muted-foreground">Discount</span>
          <span className="text-right sm:text-left">{order.discountAmount}</span>
          <span className="text-muted-foreground">Tax</span>
          <span className="text-right sm:text-left">{order.taxAmount}</span>
          <span className="text-muted-foreground">Service charge</span>
          <span className="text-right sm:text-left">{order.serviceChargeAmount}</span>
          <span className="font-medium">Grand Total</span>
          <span className="text-right font-medium sm:text-left">{order.grandTotal}</span>
          <span className="text-muted-foreground">Paid</span>
          <span className="text-right text-emerald-500 sm:text-left">{order.paidAmount}</span>
          <span className="font-medium">Due</span>
          <span className="text-right font-medium text-destructive sm:text-left">{order.dueAmount}</span>
          <span className="text-muted-foreground">Refunded</span>
          <span className="text-right sm:text-left">{order.refundedAmount}</span>
        </div>

        {editingTotals && !isLocked && (
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

        {formMode !== "none" && (
          <div className="space-y-2 border-t border-input pt-4">
            <Separator />
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
      </CardContent>
    </Card>
  )
}

function PaymentHistoryCard({ orderId }: { orderId: number }) {
  const { data: payments } = useOrderPayments(orderId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        {(payments?.data.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Paid At</TableHead>
                <TableHead>Received By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments?.data.map((payment) => <PaymentRow key={payment.id} payment={payment} />)}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function PaymentRow({ payment }: { payment: OrderPayment }) {
  const { data: receivedByUser } = useUser(payment.receivedBy ?? 0)
  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-primary">{payment.paymentNumber}</TableCell>
      <TableCell>
        <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>{payment.type}</Badge>
      </TableCell>
      <TableCell className="capitalize">{payment.method}</TableCell>
      <TableCell>{payment.provider ?? "—"}</TableCell>
      <TableCell className="font-medium">{payment.amount}</TableCell>
      <TableCell>
        <StatusBadge status={payment.status} />
      </TableCell>
      <TableCell>{payment.transactionReference ?? "—"}</TableCell>
      <TableCell>{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "—"}</TableCell>
      <TableCell>{receivedByUser?.name ?? "—"}</TableCell>
    </TableRow>
  )
}

function StatusHistoryCard({ orderId }: { orderId: number }) {
  const { data: history } = useOrderStatusHistory(orderId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status History</CardTitle>
      </CardHeader>
      <CardContent>
        {!history || history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  {entry.fromStatus && (
                    <>
                      <StatusBadge status={entry.fromStatus} />
                      <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                    </>
                  )}
                  <StatusBadge status={entry.toStatus} />
                </div>
                <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AuditCard({ order }: { order: Order }) {
  const { data: createdByUser } = useUser(order.createdBy ?? 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-y-2.5 sm:grid-cols-3">
        <DetailRow label="Created" value={new Date(order.createdAt).toLocaleString()} />
        <DetailRow label="Created By" value={createdByUser?.name ?? "—"} />
        <DetailRow label="Completed" value={order.completedAt ? new Date(order.completedAt).toLocaleString() : "—"} />
      </CardContent>
    </Card>
  )
}

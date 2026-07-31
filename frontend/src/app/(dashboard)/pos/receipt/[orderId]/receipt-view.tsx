"use client"

import { PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAddons } from "@/hooks/use-addons"
import { useOrderPayments } from "@/hooks/use-order-payments"
import { useOutlet } from "@/hooks/use-outlets"
import { useOrder, useOrderItems, type OrderItem } from "@/hooks/use-orders"
import { useFoods } from "@/hooks/use-foods"

export function ReceiptView({ orderId }: { orderId: number }) {
  const { data: order } = useOrder(orderId)
  const { data: items } = useOrderItems(orderId)
  const { data: payments } = useOrderPayments(orderId)
  const { data: outlet } = useOutlet(order?.outletId ?? 0)
  const { data: foods } = useFoods({ limit: 100 })

  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`

  if (!order) return null

  return (
    <div className="mx-auto max-w-[320px] space-y-4">
      <div className="no-print flex justify-end">
        <Button onClick={() => window.print()}>
          <PrinterIcon />
          Print
        </Button>
      </div>

      <div
        id="receipt"
        className="space-y-4 rounded-lg border border-input p-6 font-mono text-sm print:w-[80mm]"
      >
        <div className="text-center">
          <p className="font-semibold">{outlet?.name ?? `Outlet #${order.outletId}`}</p>
          <p className="text-xs text-muted-foreground">Order {order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
        </div>

        <Separator />

        <div className="space-y-2">
          {items?.data.map((item) => <ReceiptItemRow key={item.id} item={item} name={foodName(item.foodId)} />)}
        </div>

        <Separator />

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{order.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span>-{order.discountAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{order.taxAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service charge</span>
            <span>{order.serviceChargeAmount}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Grand total</span>
            <span>{order.grandTotal}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          {payments?.data.map((payment) => (
            <div key={payment.id} className="flex justify-between text-xs">
              <span>
                {payment.type} &middot; {payment.method}
              </span>
              <span>{payment.amount}</span>
            </div>
          ))}
          <div className="flex justify-between font-medium">
            <span>Paid</span>
            <span>{order.paidAmount}</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">Thank you!</p>
      </div>
    </div>
  )
}

function ReceiptItemRow({ item, name }: { item: OrderItem; name: string }) {
  const { data: addons } = useAddons({ limit: 100 })
  const addonName = (addonId: number) => addons?.data.find((a) => a.id === addonId)?.name ?? `#${addonId}`

  return (
    <div>
      <div className="flex justify-between">
        <span>
          {item.quantity} &times; {name}
        </span>
        <span>{item.totalAmount}</span>
      </div>
      {item.addons.map((link) => (
        <p key={link.id} className="pl-4 text-xs text-muted-foreground">
          + {addonName(link.addonId)}
        </p>
      ))}
      {item.note && <p className="pl-4 text-xs text-muted-foreground italic">{item.note}</p>}
    </div>
  )
}

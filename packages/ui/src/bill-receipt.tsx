import { Separator } from "./separator"
import { useAddons } from "@rms/api-client/hooks/use-addons"
import { useCustomer } from "@rms/api-client/hooks/use-customers"
import { useFoods } from "@rms/api-client/hooks/use-foods"
import { useOrderPayments } from "@rms/api-client/hooks/use-order-payments"
import { useOutlet } from "@rms/api-client/hooks/use-outlets"
import { useOrder, useOrderItems, type OrderItem } from "@rms/api-client/hooks/use-orders"
import { useSettingsCategory, type PosSettings } from "@rms/api-client/hooks/use-settings"

/**
 * The one bill layout used everywhere an order's bill is shown as a
 * printable/read-only receipt — the standalone POS receipt
 * (pos/receipt/[orderId]/receipt-view.tsx) and the bill panel on the order
 * detail page (orders/[id]/order-detail.tsx) both render this, so staff and
 * guests see the same fields in the same order no matter where they look.
 * Pulls header/footer text from Settings > POS instead of hardcoding them.
 */
export function BillReceipt({ orderId }: { orderId: number }) {
  const { data: order } = useOrder(orderId)
  const { data: items } = useOrderItems(orderId)
  const { data: payments } = useOrderPayments(orderId)
  const { data: outlet } = useOutlet(order?.outletId ?? 0)
  const { data: foods } = useFoods({ limit: 100 })
  const { data: customer } = useCustomer(order?.customerId ?? 0)
  const { data: posSettings } = useSettingsCategory<PosSettings>("pos")

  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`

  if (!order) return null

  return (
    <div className="space-y-4 font-mono text-sm">
      <div className="text-center">
        <p className="font-semibold">{outlet?.name ?? `Outlet #${order.outletId}`}</p>
        {posSettings?.receiptHeader && <p className="text-xs text-muted-foreground">{posSettings.receiptHeader}</p>}
        {customer && <p className="text-xs text-muted-foreground">Customer: {customer.name}</p>}
        <p className="text-xs text-muted-foreground">Bill No: {order.billNumber ?? order.orderNumber}</p>
        <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
      </div>

      <Separator />

      <div className="space-y-2">
        {(items?.data ?? []).length === 0 && (
          <p className="text-center text-xs text-muted-foreground">No items yet.</p>
        )}
        {items?.data.map((item) => <BillItemRow key={item.id} item={item} name={foodName(item.foodId)} />)}
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
        <div className="flex justify-between font-medium">
          <span>Due</span>
          <span>{order.dueAmount}</span>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">{posSettings?.receiptFooter || "Thank you!"}</p>
    </div>
  )
}

function BillItemRow({ item, name }: { item: OrderItem; name: string }) {
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

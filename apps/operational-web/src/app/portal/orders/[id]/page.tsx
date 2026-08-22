import { notFound } from "next/navigation"
import { verifyCustomerSession } from "@rms/auth/customer-dal"
import { customerBackendFetch } from "@rms/auth/server/customer-backend-client"
import { BillSummary } from "@rms/ui/bill-summary"

interface OrderItem {
  id: number
  foodId: number
  foodName: string
  quantity: number
  unitPrice: number
  totalAmount: number
}

interface OrderDetail {
  id: number
  orderNumber: string
  status: string
  paymentStatus: string
  subtotal: number
  discountAmount: number
  grandTotal: number
  paidAmount: number
  dueAmount: number
  loyaltyPointsEarned: number
  loyaltyDiscountAmount: number
  items: OrderItem[]
}

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyCustomerSession()
  const { id } = await params
  const response = await customerBackendFetch(`/customer-portal/orders/${id}`)
  if (!response.ok) {
    notFound()
  }
  const order = (await response.json()) as OrderDetail

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Order {order.orderNumber}</h1>
      <p className="text-muted-foreground capitalize">
        {order.status} · payment {order.paymentStatus}
      </p>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-2">Item</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Price</th>
              <th className="p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="p-2">{item.foodName}</td>
                <td className="p-2">{item.quantity}</td>
                <td className="p-2">{item.unitPrice}</td>
                <td className="p-2">{item.totalAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BillSummary order={order} />
      <div className="grid grid-cols-2 gap-2 text-sm">
        {order.loyaltyPointsEarned > 0 && (
          <>
            <span className="text-muted-foreground">Loyalty points earned</span>
            <span className="text-right">{order.loyaltyPointsEarned}</span>
          </>
        )}
      </div>
    </div>
  )
}

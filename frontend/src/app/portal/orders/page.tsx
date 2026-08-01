import Link from "next/link"
import { verifyCustomerSession } from "@/lib/auth/customer-dal"
import { customerBackendFetch } from "@/lib/server/customer-backend-client"
import type { PaginatedResponse } from "@/lib/api/types"
import type { PortalOrder } from "@/hooks/use-customer-portal"

export default async function CustomerOrdersPage() {
  await verifyCustomerSession()
  const response = await customerBackendFetch("/customer-portal/orders")
  const orders: PaginatedResponse<PortalOrder> = response.ok
    ? await response.json()
    : { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      <h1 className="text-xl font-semibold">Order history</h1>
      {orders.data.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
      <ul className="flex flex-col gap-2">
        {orders.data.map((order) => (
          <li key={order.id}>
            <Link
              href={`/portal/orders/${order.id}`}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted"
            >
              <div>
                <p className="font-medium">{order.orderNumber}</p>
                <p className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{order.grandTotal}</p>
                <p className="text-sm text-muted-foreground capitalize">{order.status}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

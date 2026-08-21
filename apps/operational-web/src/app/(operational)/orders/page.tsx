"use client"

import { useMemo } from "react"

import { StatusBadge } from "@rms/ui/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useKdsBootstrap } from "@rms/api-client/hooks/use-kitchen-tickets"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { CreateOrderDialog } from "./create-order-dialog"

interface OrderItemRow {
  id: number
  label: string
  price: number
  status: string
}

interface TableGroup {
  tableName: string
  items: OrderItemRow[]
}

export default function OrdersPage() {
  const { outletId } = useActiveOutlet()
  const { data, isLoading } = useKdsBootstrap(outletId)

  const groups = useMemo<TableGroup[]>(() => {
    const byTable = new Map<string, TableGroup>()
    for (const ticket of data?.tickets ?? []) {
      const tableName = ticket.order?.tableSession?.diningTable?.name ?? "Takeaway"
      const rows: OrderItemRow[] = (ticket.items ?? []).map((item) => ({
        id: item.id,
        label: `${item.orderItem?.quantity ?? 1} × ${item.orderItem?.food?.name ?? "Item"}${
          item.orderItem?.foodVariant?.name ? ` — ${item.orderItem.foodVariant.name}` : ""
        }`,
        price: item.orderItem?.totalAmount ?? 0,
        status: item.status,
      }))
      const existing = byTable.get(tableName)
      if (existing) {
        existing.items.push(...rows)
      } else {
        byTable.set(tableName, { tableName, items: rows })
      }
    }
    return [...byTable.values()]
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orders</h1>
        <CreateOrderDialog />
      </div>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active order items right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.tableName}>
              <CardHeader>
                <CardTitle className="text-sm">{group.tableName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 border-b border-input py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.price}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useRouter } from "next/navigation"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOrders } from "@/hooks/use-orders"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { useDiningTables } from "@/hooks/use-dining-tables"

const CLOSED_STATUSES = new Set(["completed", "cancelled"])

/** Lets staff jump between every currently open sale at this outlet without going back through /floor. */
export function OrderSwitcher({ outletId, activeOrderId }: { outletId: number; activeOrderId: number | null }) {
  const router = useRouter()
  const { data: orders } = useOrders({ outletId, limit: 100 })
  const { data: sessions } = useTableSessions({ outletId, status: "active", limit: 100 })
  const { data: tables } = useDiningTables({ outletId, limit: 100 })

  const openOrders = (orders?.data ?? []).filter((order) => !CLOSED_STATUSES.has(order.status))
  if (openOrders.length === 0) return null

  const tableNameBySessionId = new Map<number, string>()
  for (const session of sessions?.data ?? []) {
    const table = tables?.data.find((t) => t.id === session.diningTableId)
    if (table) tableNameBySessionId.set(session.id, table.name)
  }

  function labelFor(order: (typeof openOrders)[number]) {
    const tableName = order.tableSessionId ? tableNameBySessionId.get(order.tableSessionId) : undefined
    return tableName ?? `${order.orderType} #${order.orderNumber}`
  }

  return (
    <div className="w-56">
      <Select
        value={activeOrderId ? String(activeOrderId) : ""}
        onValueChange={(value) => value && router.push(`/pos?orderId=${value}`)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Switch sale (${openOrders.length} open)`} />
        </SelectTrigger>
        <SelectContent>
          {openOrders.map((order) => (
            <SelectItem key={order.id} value={String(order.id)}>
              {labelFor(order)} &middot; {order.status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

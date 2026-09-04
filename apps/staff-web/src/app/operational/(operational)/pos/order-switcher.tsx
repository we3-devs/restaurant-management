"use client"

import { useRouter } from "next/navigation"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Skeleton } from "@rms/ui/skeleton"
import { useOrders } from "@rms/api-client/hooks/use-orders"
import { useTableSessions } from "@rms/api-client/hooks/use-table-sessions"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"

const CLOSED_STATUSES = new Set(["completed", "cancelled"])

/**
 * Lets staff jump between every currently open sale at this outlet without
 * going back through /floor. A table session can carry more than one open
 * order now, so those are grouped into a single "R2" entry (not one row per
 * order) — picking it goes to ?tableId=, which pos/page.tsx already resolves
 * into either the lone order or a TableOrdersDialog to choose/start one.
 * Orders with no table session (grab-and-go/stay/delivery) still list
 * individually by order number, since there's nothing to group them under.
 */
export function OrderSwitcher({ outletId, activeOrderId }: { outletId: number; activeOrderId: number | null }) {
  const router = useRouter()
  const { data: orders, isLoading } = useOrders({ outletId, limit: 100 })
  const { data: sessions } = useTableSessions({ outletId, status: "active", limit: 100 })
  const { data: tables } = useDiningTables({ outletId, limit: 100 })

  const openOrders = (orders?.data ?? []).filter((order) => !CLOSED_STATUSES.has(order.status))
  // Keep the header slot occupied while the open-sale list is in flight so
  // the layout doesn't pop when it lands.
  if (isLoading) return <Skeleton className="h-9 w-56 rounded-md" />
  if (openOrders.length === 0) return null

  const tableNameBySessionId = new Map<number, string>()
  const diningTableIdBySessionId = new Map<number, number>()
  for (const session of sessions?.data ?? []) {
    const table = tables?.data.find((t) => t.id === session.diningTableId)
    if (table) tableNameBySessionId.set(session.id, table.name)
    diningTableIdBySessionId.set(session.id, session.diningTableId)
  }

  const tableEntries = new Map<number, { tableName: string; diningTableId: number; count: number }>()
  const standaloneOrders: (typeof openOrders)[number][] = []
  for (const order of openOrders) {
    const diningTableId = order.tableSessionId ? diningTableIdBySessionId.get(order.tableSessionId) : undefined
    if (order.tableSessionId && diningTableId !== undefined) {
      const existing = tableEntries.get(order.tableSessionId)
      if (existing) {
        existing.count += 1
      } else {
        tableEntries.set(order.tableSessionId, {
          tableName: tableNameBySessionId.get(order.tableSessionId) ?? "Loading…",
          diningTableId,
          count: 1,
        })
      }
    } else {
      standaloneOrders.push(order)
    }
  }

  const activeOrder = openOrders.find((order) => order.id === activeOrderId)
  const activeValue = activeOrder?.tableSessionId
    ? `table:${activeOrder.tableSessionId}`
    : activeOrderId
      ? `order:${activeOrderId}`
      : ""

  function handleChange(value: string | null) {
    if (!value) return
    const [kind, id] = value.split(":")
    if (kind === "table") {
      const entry = [...tableEntries.entries()].find(([sessionId]) => String(sessionId) === id)
      if (entry) router.push(`/operational/pos?tableId=${entry[1].diningTableId}`)
    } else {
      router.push(`/operational/pos?orderId=${id}`)
    }
  }

  return (
    <div className="w-56">
      <Select value={activeValue} onValueChange={handleChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Switch sale (${openOrders.length} open)`} />
        </SelectTrigger>
        <SelectContent>
          {[...tableEntries.entries()].map(([sessionId, entry]) => (
            <SelectItem key={`table:${sessionId}`} value={`table:${sessionId}`}>
              {entry.tableName}
              {entry.count > 1 ? ` · ${entry.count} orders` : ""}
            </SelectItem>
          ))}
          {standaloneOrders.map((order) => (
            <SelectItem key={`order:${order.id}`} value={`order:${order.id}`}>
              {order.orderType} #{order.orderNumber} &middot; {order.status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

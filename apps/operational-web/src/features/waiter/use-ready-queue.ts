import { useMemo, useState } from "react"
import { useEffect } from "react"

import { useKdsBootstrap } from "@rms/api-client/hooks/use-kitchen-tickets"

export interface ReadyGroup {
  orderId: number
  tableName: string
  orderNumber: string
  itemLabels: { id: number; label: string; readyAt: string | null }[]
  earliestReadyAt: string
}

function minReadyAt(current: string, labels: { readyAt: string | null }[]): string {
  return labels.reduce((min, l) => (l.readyAt && (!min || l.readyAt < min) ? l.readyAt : min), current)
}

/**
 * Groups every "ready" kitchen-ticket item by order, for the waitstaff
 * ready-to-deliver queue. Shared by the desktop Service page and the staff
 * mobile ready queue — both must show the same set of ready items.
 */
export function useReadyQueueGroups(outletId: number | null) {
  const { data, isLoading } = useKdsBootstrap(outletId)

  // Live clock so "…m ago" ticks without a refetch.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const groups = useMemo<ReadyGroup[]>(() => {
    const byOrder = new Map<number, ReadyGroup>()
    for (const ticket of data?.tickets ?? []) {
      const readyItems = (ticket.items ?? []).filter((item) => item.status === "ready")
      if (readyItems.length === 0) continue
      const existing = byOrder.get(ticket.orderId)
      const tableName = ticket.order?.tableSession?.diningTable?.name ?? "Takeaway"
      const orderNumber = ticket.order?.orderNumber ?? `#${ticket.orderId}`
      const labels = readyItems.map((item) => ({
        id: item.id,
        label: `${item.orderItem?.food?.name ?? "Item"} ×${item.orderItem?.quantity ?? 1}`,
        readyAt: item.readyAt,
      }))
      if (existing) {
        existing.itemLabels.push(...labels)
        existing.earliestReadyAt = minReadyAt(existing.earliestReadyAt, labels)
      } else {
        byOrder.set(ticket.orderId, {
          orderId: ticket.orderId,
          tableName,
          orderNumber,
          itemLabels: labels,
          earliestReadyAt: labels.reduce(
            (min, l) => (l.readyAt && (!min || l.readyAt < min) ? l.readyAt : min),
            "" as string,
          ),
        })
      }
    }
    return [...byOrder.values()].sort((a, b) => a.earliestReadyAt.localeCompare(b.earliestReadyAt))
  }, [data])

  const readyCount = groups.reduce((sum, g) => sum + g.itemLabels.length, 0)

  return { groups, readyCount, now, isLoading }
}

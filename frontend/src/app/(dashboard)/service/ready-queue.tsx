"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2Icon, ChefHatIcon, ClockIcon, PackageCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useKdsBootstrap } from "@/hooks/use-kitchen-tickets"
import { useMarkOrderReadyItemsServed } from "@/hooks/use-orders"

interface ReadyGroup {
  orderId: number
  tableName: string
  orderNumber: string
  itemLabels: { id: number; label: string; readyAt: string | null }[]
  earliestReadyAt: string
}

function elapsedMinutes(since: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000))
}

export function ReadyQueue({ outletId }: { outletId: number }) {
  const { data, isLoading } = useKdsBootstrap(outletId)
  const [now, setNow] = useState(() => Date.now())

  // Live clock so "…m ago" ticks without a refetch.
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <CheckCircle2Icon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Ready queue is clear</p>
        <p className="text-sm text-muted-foreground">
          Dishes the kitchen marks ready will appear here for delivery.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {readyCount} item{readyCount === 1 ? "" : "s"} ready to deliver
        </p>
        <Badge variant="outline">{groups.length} table{groups.length === 1 ? "" : "s"}</Badge>
      </div>
      {groups.map((group) => (
        <ReadyGroupCard key={group.orderId} group={group} now={now} outletId={outletId} />
      ))}
    </div>
  )
}

function minReadyAt(current: string, labels: { readyAt: string | null }[]): string {
  return labels.reduce(
    (min, l) => (l.readyAt && (!min || l.readyAt < min) ? l.readyAt : min),
    current,
  )
}

function ReadyGroupCard({
  group,
  now,
  outletId,
}: {
  group: ReadyGroup
  now: number
  outletId: number
}) {
  const markServed = useMarkOrderReadyItemsServed(group.orderId, outletId)
  const [confirming, setConfirming] = useState(false)

  async function handleDeliver() {
    try {
      await markServed.mutateAsync()
      toast.success(`${group.tableName} items delivered`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark delivered")
    }
  }

  return (
    <Card className="gap-3 p-4 ring-1 ring-emerald-500/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold leading-tight">{group.tableName}</p>
            <span className="text-xs text-muted-foreground">{group.orderNumber}</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon className="size-3" />
            Ready {elapsedMinutes(group.earliestReadyAt, now)}m ago
          </p>
        </div>
        {confirming ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={markServed.isPending}
              onClick={handleDeliver}
            >
              <PackageCheckIcon />
              {markServed.isPending ? "Delivering..." : "Confirm"}
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setConfirming(true)} disabled={markServed.isPending}>
            <PackageCheckIcon />
            Mark Delivered
          </Button>
        )}
      </div>

      <ul className="space-y-1">
        {group.itemLabels.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm"
          >
            <ChefHatIcon className="size-3.5 shrink-0 text-emerald-500" />
            <span className="truncate font-medium">{item.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { CheckCircle2Icon, ChefHatIcon, ClockIcon, PackageCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMarkOrderReadyItemsServed } from "@/hooks/use-orders"
import { useReadyQueueGroups, type ReadyGroup } from "@/features/waiter/use-ready-queue"
import { elapsedMinutes } from "@/features/kitchen/ticket-stage"

export function ReadyQueue({ outletId }: { outletId: number }) {
  const { groups, readyCount, now, isLoading } = useReadyQueueGroups(outletId)

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

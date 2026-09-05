"use client"

import { useState } from "react"
import { CheckCircle2Icon, ChefHatIcon, ClockIcon, PackageCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Card } from "@rms/ui/card"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useMarkOrderReadyItemServed, useMarkOrderReadyItemsServed } from "@rms/api-client/hooks/use-orders"
import { useReadyQueueGroups, type ReadyGroup } from "@/features/waiter/use-ready-queue"
import { elapsedMinutes } from "@rms/api-client/kitchen/ticket-stage"

export function ReadyQueue({ outletId }: { outletId: number }) {
  const { groups, readyCount, now, isLoading } = useReadyQueueGroups(outletId)

  if (isLoading) {
    return <ListSkeleton count={2} />
  }

  if (groups.length === 0) {
    return (
      <div className="h-fill flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <CheckCircle2Icon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Ready queue is clear</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
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
  const markServed = useMarkOrderReadyItemServed(group.orderId, outletId)
  const markAllServed = useMarkOrderReadyItemsServed(group.orderId, outletId)
  const [confirming, setConfirming] = useState<number | null>(null)

  async function handleDeliver(itemId: number) {
    try {
      await markServed.mutateAsync(itemId)
      setConfirming(null)
      toast.success("Item delivered")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark delivered")
    }
  }

  async function handleDeliverAll() {
    try {
      await markAllServed.mutateAsync()
      setConfirming(null)
      toast.success("All ready items delivered")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark all items delivered")
    }
  }

  return (
    <Card className="gap-3 p-4 ring-1 ring-emerald-500/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold leading-tight">{group.tableName}</p>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon className="size-3" />
            Ready {elapsedMinutes(group.earliestReadyAt, now)}m ago
          </p>
        </div>
        <Button
          size="sm"
          disabled={markAllServed.isPending || markServed.isPending}
          onClick={handleDeliverAll}
        >
          <PackageCheckIcon />
          {markAllServed.isPending ? "Delivering..." : "Deliver all"}
        </Button>
      </div>

      <ul className="space-y-1">
        {group.itemLabels.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm"
          >
            <ChefHatIcon className="size-3.5 shrink-0 text-emerald-500" />
            <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
            {confirming === item.id ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
                <Button size="sm" disabled={markServed.isPending} onClick={() => handleDeliver(item.id)}>
                  <PackageCheckIcon /> Confirm
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" disabled={markServed.isPending} onClick={() => setConfirming(item.id)}>
                <PackageCheckIcon /> Deliver
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

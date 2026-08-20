"use client"

import { useState } from "react"
import { CheckCircle2Icon, CheckIcon, PlayIcon, RotateCcwIcon, XIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rms/ui/alert-dialog"
import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Card } from "@rms/ui/card"
import { cn } from "@rms/ui/cn"
import { ItemStatusIcon } from "@rms/api-client/kitchen/item-status-icon"
import { elapsedMinutes, formatTime, ticketStage } from "@rms/api-client/kitchen/ticket-stage"
import {
  useCancelKitchenTicket,
  useMarkKitchenTicketReady,
  useMarkKitchenTicketServed,
  useRecallKitchenTicketItem,
  useStartKitchenTicket,
  useUpdateKitchenTicketItemStatus,
  type KitchenTicket,
  type KitchenTicketItem,
} from "@rms/api-client/hooks/use-kitchen-tickets"

const PRIORITY_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  normal: "secondary",
  high: "outline",
  urgent: "destructive",
}

/**
 * Mobile counterpart to (dashboard)/kitchen's TicketCard — same mutations
 * and the same shared ticketStage()/ItemStatusIcon logic, but a single
 * ≥56px primary action per card instead of a dense action row, since this
 * is meant to be operated one-handed on a phone.
 */
export function MobileTicketCard({
  ticket,
  now,
  canManage,
  canMarkReady,
  canCancel,
}: {
  ticket: KitchenTicket
  now: number
  canManage: boolean
  canMarkReady: boolean
  canCancel: boolean
}) {
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const outletId = ticket.outletId
  const start = useStartKitchenTicket(outletId)
  const markReady = useMarkKitchenTicketReady(outletId)
  const markServed = useMarkKitchenTicketServed(outletId)
  const updateStatus = useUpdateKitchenTicketItemStatus(outletId)
  const recall = useRecallKitchenTicketItem(outletId)
  const cancelTicket = useCancelKitchenTicket(outletId)

  const items = ticket.items ?? []
  const stage = ticketStage(ticket)
  const tableName = ticket.order?.tableSession?.diningTable?.name
  const orderLabel = ticket.order?.orderNumber ?? "Loading…"
  const foodName = (item: KitchenTicketItem) =>
    item.orderItem?.food?.name ?? "Loading…"
  const variantName = (item: KitchenTicketItem) => item.orderItem?.foodVariant?.name

  return (
    <Card
      className={cn(
        "gap-4 overflow-hidden rounded-2xl border-0 p-0 shadow-sm ring-1 ring-border/70",
        stage === "ready" && "ring-2 ring-emerald-500/40",
        stage === "preparing" && "ring-2 ring-sky-500/25",
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-base font-semibold leading-tight">{tableName ?? "Takeaway"}</p>
            <span className="text-xs text-muted-foreground">{orderLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Sent {formatTime(ticket.createdAt)}
            <span className="font-medium text-foreground/70"> · {elapsedMinutes(ticket.createdAt, now)}m</span>
            {ticket.department?.name ? ` · ${ticket.department.name}` : ""}
          </p>
        </div>
        <Badge variant={PRIORITY_VARIANT[ticket.priority]} className="shrink-0 capitalize">
          {ticket.priority}
        </Badge>
      </div>

      <ul className="space-y-2 px-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <ItemStatusIcon status={item.status} />
              <span className="truncate text-sm">
                <span className="font-medium">{item.orderItem?.quantity ?? 1}×</span> {foodName(item)}
                {variantName(item) ? ` (${variantName(item)})` : ""}
              </span>
              {item.recallCount > 0 && (
                <span className="shrink-0 text-xs text-amber-600" title={`Recalled ${item.recallCount}×`}>
                  ↺{item.recallCount}
                </span>
              )}
            </div>
            {canManage && (item.status === "ready" || item.status === "served") && (
              <Button
                size="icon"
                variant="ghost"
                className="size-10"
                disabled={recall.isPending}
                onClick={() => recall.mutate({ ticketId: ticket.id, itemId: item.id })}
                aria-label="Recall item"
              >
                <RotateCcwIcon />
              </Button>
            )}
            {canManage && canCancel && item.status !== "served" && item.status !== "cancelled" && (
              <Button
                size="icon"
                variant="ghost"
                className="size-10"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ ticketId: ticket.id, itemId: item.id, status: "cancelled" })}
                aria-label="Cancel item"
              >
                <XIcon />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (stage === "incoming" || (stage === "preparing" && canMarkReady) || canCancel) && (
        <div className="flex items-center gap-2 px-4 pb-4">
          {stage === "incoming" && (
            <Button
              className="h-14 flex-1 text-base"
              disabled={start.isPending}
              onClick={() => start.mutate(ticket.id)}
            >
              <PlayIcon className="size-5" />
              {start.isPending ? "Starting..." : "Start"}
            </Button>
          )}
          {stage === "preparing" && canMarkReady && (
            <Button
              className="h-14 flex-1 text-base"
              variant="outline"
              disabled={markReady.isPending}
              onClick={() => markReady.mutate(ticket.id)}
            >
              <CheckCircle2Icon className="size-5" />
              {markReady.isPending ? "Marking..." : "Mark Ready"}
            </Button>
          )}
          {stage === "ready" && (
            <Button
              className="h-14 flex-1 text-base"
              variant="secondary"
              disabled={markServed.isPending}
              onClick={() => markServed.mutate(ticket.id)}
            >
              <CheckIcon className="size-5" />
              {markServed.isPending ? "Marking..." : "Mark Served"}
            </Button>
          )}
          {canCancel && (
            <Button
              size="icon"
              variant="ghost"
              className="size-14"
              disabled={cancelTicket.isPending}
              onClick={() => setCancelConfirmOpen(true)}
              aria-label="Cancel ticket"
            >
              <XIcon className="size-5" />
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              All open items on {tableName ?? "this order"} ({orderLabel}) will be cancelled and removed
              from the queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep ticket</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelTicket.isPending}
              onClick={() => {
                cancelTicket.mutate(ticket.id)
                setCancelConfirmOpen(false)
              }}
            >
              Cancel ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

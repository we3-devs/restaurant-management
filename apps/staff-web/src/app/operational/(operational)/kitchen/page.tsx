"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2Icon, CheckIcon, ChefHatIcon, PlayIcon, RotateCcwIcon, XIcon } from "lucide-react"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { useKitchenRealtime } from "@rms/api-client/hooks/use-kitchen-realtime"
import {
  useCancelKitchenTicket,
  useKdsBootstrap,
  useMarkKitchenTicketReady,
  useMarkKitchenTicketServed,
  useRecallKitchenTicketItem,
  useStartKitchenTicket,
  useUpdateKitchenTicketItemStatus,
  useUpdateKitchenTicketPriority,
  type KitchenTicket,
  type KitchenTicketItem,
} from "@rms/api-client/hooks/use-kitchen-tickets"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { KITCHEN_TICKET_PRIORITIES } from "@rms/validators/kitchen-tickets"
import { cn } from "@rms/ui/cn"
import { ItemStatusIcon } from "@rms/api-client/kitchen/item-status-icon"
import { elapsedMinutes, formatTime, ticketStage, type TicketStage } from "@rms/api-client/kitchen/ticket-stage"

const COLUMNS: { stage: TicketStage; label: string; dot: string }[] = [
  { stage: "incoming", label: "Incoming", dot: "bg-amber-500" },
  { stage: "preparing", label: "Preparing", dot: "bg-sky-500" },
  { stage: "ready", label: "Ready", dot: "bg-emerald-500" },
]

const PRIORITY_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  normal: "secondary",
  high: "outline",
  urgent: "destructive",
}

const STAGE_VARIANT: Record<TicketStage, "default" | "outline" | "secondary"> = {
  incoming: "default",
  preparing: "outline",
  ready: "secondary",
}

function TicketCard({
  ticket,
  now,
  canManage,
}: {
  ticket: KitchenTicket
  now: number
  canManage: boolean
}) {
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const outletId = ticket.outletId
  const start = useStartKitchenTicket(outletId)
  const markReady = useMarkKitchenTicketReady(outletId)
  const markServed = useMarkKitchenTicketServed(outletId)
  const updateStatus = useUpdateKitchenTicketItemStatus(outletId)
  const updatePriority = useUpdateKitchenTicketPriority(outletId)
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
        "gap-3 p-3",
        stage === "ready" && "ring-2 ring-emerald-500/40",
        stage === "preparing" && "ring-1 ring-sky-500/30",
      )}
    >
      {/* Header: table / order / sent time */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
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
        <Badge variant={PRIORITY_VARIANT[ticket.priority]}>{ticket.priority}</Badge>
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2 py-1.5"
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
            <div className="flex shrink-0 items-center gap-0.5">
              {canManage && (item.status === "ready" || item.status === "served") && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={recall.isPending}
                  onClick={() => recall.mutate({ ticketId: ticket.id, itemId: item.id })}
                  aria-label="Recall item"
                >
                  <RotateCcwIcon />
                </Button>
              )}
              {canManage && item.status !== "served" && item.status !== "cancelled" && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({ ticketId: ticket.id, itemId: item.id, status: "cancelled" })
                  }
                  aria-label="Cancel item"
                >
                  <XIcon />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Footer actions */}
      {canManage && (
        <div className="flex items-center gap-2">
          {stage === "incoming" && (
            <Button
              className="flex-1"
              variant={STAGE_VARIANT.incoming}
              disabled={start.isPending}
              onClick={() => start.mutate(ticket.id)}
            >
              <PlayIcon />
              {start.isPending ? "Starting..." : "Start"}
            </Button>
          )}
          {stage === "preparing" && (
            <Button
              className="flex-1"
              variant={STAGE_VARIANT.preparing}
              disabled={markReady.isPending}
              onClick={() => markReady.mutate(ticket.id)}
            >
              <CheckCircle2Icon />
              {markReady.isPending ? "Marking..." : "Mark Ready"}
            </Button>
          )}
          {stage === "ready" && (
            <Button
              className="flex-1"
              variant={STAGE_VARIANT.ready}
              disabled={markServed.isPending}
              onClick={() => markServed.mutate(ticket.id)}
            >
              <CheckIcon />
              {markServed.isPending ? "Marking..." : "Mark Served"}
            </Button>
          )}
          <Select
            value={ticket.priority}
            onValueChange={(value) => value && updatePriority.mutate({ ticketId: ticket.id, priority: value })}
          >
            <SelectTrigger size="sm" className="w-24" aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KITCHEN_TICKET_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            disabled={cancelTicket.isPending}
            onClick={() => setCancelConfirmOpen(true)}
            aria-label="Cancel ticket"
          >
            <XIcon />
          </Button>
        </div>
      )}

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              All open items on {tableName ?? "this order"} ({orderLabel}) will be cancelled and
              removed from the queue.
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

export default function KitchenPage() {
  const { permissions, isSuperadmin, roleSlugs } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("kitchen-tickets.manage")

  const { outletId: effectiveOutletId, departmentId } = useActiveOutlet()
  const isKitchenStaff = !isSuperadmin && (roleSlugs.includes("cook") || roleSlugs.includes("kitchen-helper"))

  // Live clock driving the "…m ago" timers so they tick without a refetch.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useKitchenRealtime(effectiveOutletId)
  const { data, isLoading } = useKdsBootstrap(effectiveOutletId)
  const showSkeleton = useDelayedLoading(isLoading)

  const tickets = useMemo(() => data?.tickets ?? [], [data])
  const stations = data?.stations ?? []
  // The bootstrap API already returns the caller's authorized stations.
  const visibleStations = stations
  const hasUngrouped = tickets.some((ticket) => ticket.departmentId === null)

  // Filter to one station so each department only sees its own queue. Both
  // the outlet AND department are stored alongside the selection so
  // switching either from the header resets the filter without a
  // setState-in-effect (lint forbids those) — previously this only keyed off
  // outletId, so picking a different kitchen from the header nav while
  // staying on the same outlet silently did nothing. Defaults to the active
  // outlet/department context's selected department, if it's one of this
  // outlet's stations, instead of dumping everyone into "all stations".
  const assignedStation = visibleStations.find((s) => s.id === departmentId)
  const [stationState, setStationState] = useState<{
    outletId: number | null
    departmentId: number | null
    station: string
  }>({
    outletId: null,
    departmentId: null,
    station: "all",
  })
  const station =
    stationState.outletId === effectiveOutletId && stationState.departmentId === departmentId
      ? stationState.station
      : (isKitchenStaff ? "all" : (assignedStation ? String(assignedStation.id) : "all"))
  const selectStation = (value: string) =>
    setStationState({ outletId: effectiveOutletId, departmentId, station: value })

  const visibleTickets = useMemo(() => {
    if (station === "all") {
      return tickets
    }
    if (station === "ungrouped") return tickets.filter((ticket) => ticket.departmentId === null)
    return tickets.filter((ticket) => ticket.departmentId === Number(station))
  }, [isKitchenStaff, tickets, station, visibleStations])

  const grouped = useMemo(() => {
    const buckets: Record<TicketStage, KitchenTicket[]> = { incoming: [], preparing: [], ready: [] }
    for (const ticket of visibleTickets) {
      buckets[ticketStage(ticket)].push(ticket)
    }
    return buckets
  }, [visibleTickets])

  const clock = new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Kitchen Display</h1>
          <span className="text-sm tabular-nums text-muted-foreground">{clock}</span>
        </div>
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : showSkeleton ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
          <ListSkeleton count={3} />
          <ListSkeleton count={3} />
          <ListSkeleton count={3} />
        </div>
      ) : tickets.length === 0 && stations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ChefHatIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No active kitchen tickets</p>
          <p className="text-sm text-muted-foreground">Orders sent to the kitchen will show up here.</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Station tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={station === "all" ? "default" : "ghost"}
              onClick={() => selectStation("all")}
            >
              {isKitchenStaff ? "All assigned stations" : "All stations"}
              <Badge variant="outline" className="ml-1">
                {tickets.length}
              </Badge>
            </Button>
            {visibleStations.map((s) => {
              const count = tickets.filter((ticket) => ticket.departmentId === s.id).length
              return (
                <Button
                  key={s.id}
                  size="sm"
                  variant={station === String(s.id) ? "default" : "ghost"}
                  onClick={() => selectStation(String(s.id))}
                >
                  {s.name}
                  <Badge variant="outline" className="ml-1">
                    {count}
                  </Badge>
                </Button>
              )
            })}
            {hasUngrouped && (
              <Button
                size="sm"
                variant={station === "ungrouped" ? "default" : "ghost"}
                onClick={() => selectStation("ungrouped")}
              >
                Ungrouped
                <Badge variant="outline" className="ml-1">
                  {tickets.filter((ticket) => ticket.departmentId === null).length}
                </Badge>
              </Button>
            )}
          </div>

          {/* Board */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map((column) => {
              const columnTickets = grouped[column.stage]
              return (
                <div
                  key={column.stage}
                  className="flex min-h-0 flex-col rounded-xl border border-border bg-muted/30"
                >
                  <div className="flex items-center justify-between border-b px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", column.dot)} />
                      <h2 className="text-sm font-semibold">{column.label}</h2>
                    </div>
                    <Badge variant="outline">{columnTickets.length}</Badge>
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {columnTickets.length === 0 ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">Nothing here</p>
                    ) : (
                      columnTickets.map((ticket) => (
                        <TicketCard key={ticket.id} ticket={ticket} now={now} canManage={canManage} />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

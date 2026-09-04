"use client"

import { useEffect, useMemo, useState } from "react"
import { ChefHatIcon } from "lucide-react"

import { Badge } from "@rms/ui/badge"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useKitchenRealtime } from "@rms/api-client/hooks/use-kitchen-realtime"
import { useKdsBootstrap, type KitchenTicket } from "@rms/api-client/hooks/use-kitchen-tickets"
import { ticketStage, type TicketStage } from "@rms/api-client/kitchen/ticket-stage"
import { MobileTicketCard } from "../../kitchen/mobile-ticket-card"

const STAGE_LABELS: Record<TicketStage, string> = {
  incoming: "Not started",
  preparing: "Preparing",
  ready: "Ready to serve",
}

const STAGE_ORDER: TicketStage[] = ["incoming", "preparing", "ready"]

/**
 * Read-only "what's left to prepare and serve" view for cashiers — same KDS
 * bootstrap data as the kitchen board, grouped by stage instead of tabbed
 * since the point is to see everything outstanding at a glance. Cashier
 * holds orders.view (via the orders module) but not kitchen-tickets.manage,
 * so passing canManage={false} to MobileTicketCard renders it as a plain
 * status list with no start/ready/serve/cancel actions.
 */
export default function StaffPrepQueuePage() {
  const { outletId } = useActiveOutlet()
  useKitchenRealtime(outletId)
  const { data, isLoading } = useKdsBootstrap(outletId)
  const showSkeleton = useDelayedLoading(isLoading)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const grouped = useMemo(() => {
    const buckets: Record<TicketStage, KitchenTicket[]> = { incoming: [], preparing: [], ready: [] }
    for (const ticket of data?.tickets ?? []) buckets[ticketStage(ticket)].push(ticket)
    return buckets
  }, [data])

  const totalRemaining = STAGE_ORDER.reduce((sum, stage) => sum + grouped[stage].length, 0)

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Prep &amp; serve</h1>
        {totalRemaining > 0 && <Badge variant="secondary">{totalRemaining} active</Badge>}
      </div>

      {!outletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : showSkeleton ? (
        <ListSkeleton count={6} />
      ) : totalRemaining === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ChefHatIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing left to prepare</p>
          <p className="text-sm text-muted-foreground">Items sent to the kitchen will show up here until served.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto">
          {STAGE_ORDER.map((stage) =>
            grouped[stage].length === 0 ? null : (
              <section key={stage} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {STAGE_LABELS[stage]} &middot; {grouped[stage].length}
                </h2>
                <div className="space-y-3">
                  {grouped[stage].map((ticket) => (
                    <MobileTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      now={now}
                      canManage={false}
                      canMarkReady={false}
                      canCancel={false}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  )
}

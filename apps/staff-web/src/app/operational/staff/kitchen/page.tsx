"use client"

import { useEffect, useMemo, useState } from "react"
import { ChefHatIcon } from "lucide-react"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useKitchenRealtime } from "@rms/api-client/hooks/use-kitchen-realtime"
import { useKdsBootstrap, type KitchenTicket } from "@rms/api-client/hooks/use-kitchen-tickets"
import { ticketStage, type TicketStage } from "@rms/api-client/kitchen/ticket-stage"
import { useWakeLock } from "@rms/api-client/kitchen/use-wake-lock"
import { MobileTicketCard } from "./mobile-ticket-card"

const STAGE_FILTERS: { stage: TicketStage; label: string; dot: string }[] = [
  { stage: "incoming", label: "Incoming", dot: "bg-amber-500" },
  { stage: "preparing", label: "Preparing", dot: "bg-sky-500" },
  { stage: "ready", label: "Ready", dot: "bg-emerald-500" },
]

/**
 * Single-column mobile counterpart to (dashboard)/kitchen's 3-column board.
 * Shares the same bootstrap query, realtime socket, mutations, and
 * ticketStage() status machine — only the layout differs.
 */
export default function StaffKitchenPage() {
  const { permissions, isSuperadmin, roleSlugs } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("kitchen-tickets.manage")
  const isKitchenStaff = !isSuperadmin && (roleSlugs.includes("cook") || roleSlugs.includes("kitchen-helper"))
  const { outletId: effectiveOutletId, departmentId, departments } = useActiveOutlet()

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useKitchenRealtime(effectiveOutletId)
  useWakeLock(!!effectiveOutletId)
  const { data, isLoading } = useKdsBootstrap(effectiveOutletId)
  const showSkeleton = useDelayedLoading(isLoading)

  const tickets = useMemo(() => data?.tickets ?? [], [data])
  const stations = data?.stations ?? []
  const visibleStations = isKitchenStaff
    ? stations.filter((station) => departments.some((department) => department.id === station.id))
    : stations
  const assignedStation = visibleStations.find((s) => s.id === departmentId)

  const [stage, setStage] = useState<TicketStage>("incoming")
  const [station, setStation] = useState<string>(() => (assignedStation ? String(assignedStation.id) : "all"))

  useEffect(() => {
    if (!isKitchenStaff || visibleStations.length === 0) return
    // "all" means all stations assigned to this kitchen user. Only repair a
    // stale specific station selection; do not replace the combined view with
    // the first station after the bootstrap request finishes.
    if (station !== "all" && !visibleStations.some((item) => String(item.id) === station)) {
      setStation(String(visibleStations[0].id))
    }
  }, [isKitchenStaff, station, visibleStations])

  const stationFiltered = useMemo(() => {
    if (station === "all") {
      if (!isKitchenStaff) return tickets
      const allowed = new Set(visibleStations.map((item) => item.id))
      return tickets.filter((ticket) => ticket.departmentId !== null && allowed.has(ticket.departmentId))
    }
    return tickets.filter((ticket) => ticket.departmentId === Number(station))
  }, [isKitchenStaff, tickets, station, visibleStations])

  const grouped = useMemo(() => {
    const buckets: Record<TicketStage, KitchenTicket[]> = { incoming: [], preparing: [], ready: [] }
    for (const ticket of stationFiltered) buckets[ticketStage(ticket)].push(ticket)
    return buckets
  }, [stationFiltered])

  const visibleTickets = grouped[stage]
  const stageFilters = isKitchenStaff ? STAGE_FILTERS.filter((filter) => filter.stage !== "ready") : STAGE_FILTERS
  const visibleActiveCount = stageFilters.reduce((count, filter) => count + grouped[filter.stage].length, 0)

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kitchen</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Your prep queue</h1>
        </div>
        {visibleActiveCount > 0 && (
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            {visibleActiveCount} active
          </Badge>
        )}
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : showSkeleton ? (
        <ListSkeleton count={6} />
      ) : (
        <>
          {visibleStations.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" className="h-9" variant={station === "all" ? "default" : "ghost"} onClick={() => setStation("all")}>
                {isKitchenStaff ? "All assigned stations" : "All stations"}
              </Button>
              {visibleStations.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  className="h-9"
                  variant={station === String(s.id) ? "default" : "ghost"}
                  onClick={() => setStation(String(s.id))}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          )}

          <div className="rounded-xl border bg-muted/40 p-1.5 shadow-sm">
            <div className={`grid gap-1.5 ${stageFilters.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {stageFilters.map((filter) => (
              <button
                key={filter.stage}
                type="button"
                onClick={() => setStage(filter.stage)}
                aria-pressed={stage === filter.stage}
                className={`flex min-h-12 items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold transition-all ${
                  stage === filter.stage
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-background/70"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${filter.dot}`} />
                  {filter.label}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {grouped[filter.stage].length}
                </Badge>
              </button>
            ))}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {visibleTickets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ChefHatIcon className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Nothing left to prepare</p>
                <p className="text-sm text-muted-foreground">Items sent to the kitchen will show up here until served.</p>
              </div>
            ) : (
              visibleTickets.map((ticket) => (
                <MobileTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  now={now}
                  canManage={canManage}
                  canMarkReady
                  canCancel={!isKitchenStaff}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

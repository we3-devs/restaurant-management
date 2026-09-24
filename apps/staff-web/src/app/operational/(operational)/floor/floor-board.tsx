"use client"

import { useMemo, useState } from "react"
import { LayoutGridIcon } from "lucide-react"

import { Skeleton } from "@rms/ui/skeleton"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useDiningAreas } from "@rms/api-client/hooks/use-dining-areas"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useReservations, useReservationTablesBatch } from "@rms/api-client/hooks/use-reservations"
import { TableCard } from "./table-card"
import type { DiningTable } from "@rms/api-client/hooks/use-dining-tables"

// How far ahead a reservation starts showing on its table's card, and how
// long it lingers after — this is deliberately a short lookahead window,
// not "every reservation dated today" (that used to dump the whole day's
// bookings onto the floor board the moment it loaded).
const ARRIVAL_WINDOW_MS = 2 * 60 * 60 * 1000
const GRACE_PERIOD_MS = 30 * 60 * 1000

function isArrivingSoon(dateString: string): boolean {
  const reservedAt = new Date(dateString).getTime()
  const now = Date.now()
  return reservedAt >= now - GRACE_PERIOD_MS && reservedAt <= now + ARRIVAL_WINDOW_MS
}

/** Maps dining table id -> soonest arriving reservation time, for tables with one. */
function useArrivingSoonByTable(outletId: number): Map<number, string> {
  const { data: pending } = useReservations({ outletId, status: "pending", limit: 100 })
  const { data: confirmed } = useReservations({ outletId, status: "confirmed", limit: 100 })

  // Memoized so a parent re-render (polling, websocket pushes — this board
  // stays open all shift) doesn't rebuild these on every render, only when
  // the underlying reservation lists actually change.
  const arrivingSoon = useMemo(
    () =>
      [...(pending?.data ?? []), ...(confirmed?.data ?? [])].filter((reservation) =>
        isArrivingSoon(reservation.reservedAt),
      ),
    [pending, confirmed],
  )
  const reservationIds = useMemo(() => arrivingSoon.map((r) => r.id), [arrivingSoon])

  // One batched request for every arriving reservation's table assignments,
  // instead of a useQueries fan-out of one GET per reservation.
  const { data: assignments } = useReservationTablesBatch(outletId, reservationIds)

  return useMemo(() => {
    const reservedAtById = new Map(arrivingSoon.map((r) => [r.id, r.reservedAt]))
    const byTable = new Map<number, string>()
    for (const assignment of assignments ?? []) {
      const reservedAt = reservedAtById.get(assignment.reservationId)
      if (!reservedAt) continue
      const soonest = byTable.get(assignment.diningTableId)
      if (!soonest || reservedAt < soonest) {
        byTable.set(assignment.diningTableId, reservedAt)
      }
    }
    return byTable
  }, [arrivingSoon, assignments])
}

export function FloorBoard({
  outletId,
  basePath,
  showHeader = true,
}: {
  outletId: number
  basePath?: string
  /** The staff-shell Tables page already has its own "Tables" page header, so this banner would be redundant there. */
  showHeader?: boolean
}) {
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)
  const arrivingSoonByTable = useArrivingSoonByTable(outletId)
  // One outlet-wide fetch instead of each AreaSection fetching its own
  // diningAreaId-filtered page — an outlet with several areas used to fire
  // one GET /dining-tables per area on every floor-board load.
  const { data: allTables } = useDiningTables({ outletId, limit: 500 })
  const tablesByArea = useMemo(() => {
    const map = new Map<number, DiningTable[]>()
    for (const table of allTables?.data ?? []) {
      const group = map.get(table.diningAreaId)
      if (group) group.push(table)
      else map.set(table.diningAreaId, [table])
    }
    return map
  }, [allTables])

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2.5">
          <div className="flex items-center gap-2">
            <LayoutGridIcon className="size-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Floor map</p>
              <p className="text-xs text-muted-foreground">
                Dashboard-configured floor plan. Tap a table to start a sale.
              </p>
            </div>
          </div>
        </div>
      )}
      {showSkeleton && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      {!showSkeleton && (areas?.data.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">No dining areas configured for this outlet.</p>
      )}
      {areas?.data.map((area) => (
        <AreaSection
          key={area.id}
          areaName={area.name}
          tables={tablesByArea.get(area.id) ?? []}
          arrivingSoonByTable={arrivingSoonByTable}
          basePath={basePath}
        />
      ))}
    </div>
  )
}

function AreaSection({
  areaName,
  tables,
  arrivingSoonByTable,
  basePath,
}: {
  areaName: string
  tables: DiningTable[]
  arrivingSoonByTable: Map<number, string>
  basePath?: string
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{areaName}</h2>
        <span className="text-xs text-muted-foreground">{tables.length} tables</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {tables.map((table) => (
          <TableCard key={table.id} table={table} arrivingAt={arrivingSoonByTable.get(table.id)} basePath={basePath} />
        ))}
        {tables.length === 0 && <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">No tables in this area yet.</p>}
      </div>
      <div className="relative hidden h-[340px] overflow-hidden rounded-xl border bg-muted/20 [background-image:linear-gradient(to_right,hsl(var(--border)/.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/.35)_1px,transparent_1px)] [background-size:32px_32px] sm:block">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-amber-500/[0.04]" />
        {tables.map((table, index) => (
          <MapTable key={table.id} table={table} index={index} arrivingAt={arrivingSoonByTable.get(table.id)} basePath={basePath} />
        ))}
        {tables.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No tables in this area yet.</p>}
      </div>
    </section>
  )
}

function getPosition(index: number, position?: { x: number; y: number }) {
  if (position && (position.x !== 0 || position.y !== 0)) return position
  return { x: 12 + (index % 4) * 23, y: 18 + Math.floor(index / 4) * 30 }
}

function MapTable({ table, index, arrivingAt, basePath }: { table: DiningTable; index: number; arrivingAt?: string; basePath?: string }) {
  const point = getPosition(index, { x: table.positionX, y: table.positionY })
  return (
    <div className="absolute w-20 -translate-x-1/2 -translate-y-1/2 sm:w-28" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
      <TableCard table={table} arrivingAt={arrivingAt} basePath={basePath} />
    </div>
  )
}

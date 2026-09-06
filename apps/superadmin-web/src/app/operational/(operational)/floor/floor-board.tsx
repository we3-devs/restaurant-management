"use client"

import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { LayoutGridIcon } from "lucide-react"

import { Skeleton } from "@rms/ui/skeleton"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { apiClient } from "@rms/api-client/client"
import { queryKeys } from "@rms/api-client/query-keys"
import { useDiningAreas } from "@rms/api-client/hooks/use-dining-areas"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useReservations, type ReservationTableAssignment } from "@rms/api-client/hooks/use-reservations"
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

  const arrivingSoon = [...(pending?.data ?? []), ...(confirmed?.data ?? [])].filter((reservation) =>
    isArrivingSoon(reservation.reservedAt),
  )

  const tableAssignments = useQueries({
    queries: arrivingSoon.map((reservation) => ({
      queryKey: queryKeys.reservations.tables(reservation.id),
      queryFn: () => apiClient<ReservationTableAssignment[]>(`/reservations/${reservation.id}/tables`),
    })),
  })

  const byTable = new Map<number, string>()
  arrivingSoon.forEach((reservation, index) => {
    for (const assignment of tableAssignments[index]?.data ?? []) {
      const soonest = byTable.get(assignment.diningTableId)
      if (!soonest || reservation.reservedAt < soonest) {
        byTable.set(assignment.diningTableId, reservation.reservedAt)
      }
    }
  })
  return byTable
}

export function FloorBoard({ outletId, basePath }: { outletId: number; basePath?: string }) {
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)
  const arrivingSoonByTable = useArrivingSoonByTable(outletId)

  return (
    <div className="space-y-4">
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
          outletId={outletId}
          areaId={area.id}
          areaName={area.name}
          arrivingSoonByTable={arrivingSoonByTable}
          basePath={basePath}
        />
      ))}
    </div>
  )
}

function AreaSection({
  outletId,
  areaId,
  areaName,
  arrivingSoonByTable,
  basePath,
}: {
  outletId: number
  areaId: number
  areaName: string
  arrivingSoonByTable: Map<number, string>
  basePath?: string
}) {
  const { data: tables } = useDiningTables({ outletId, diningAreaId: areaId, limit: 100 })

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{areaName}</h2>
        <span className="text-xs text-muted-foreground">{tables?.data.length ?? 0} tables</span>
      </div>
      <div className="relative h-[340px] overflow-hidden rounded-xl border bg-muted/20 [background-image:linear-gradient(to_right,hsl(var(--border)/.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/.35)_1px,transparent_1px)] [background-size:32px_32px]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-amber-500/[0.04]" />
        {(tables?.data ?? []).map((table, index) => (
          <MapTable key={table.id} table={table} index={index} arrivingAt={arrivingSoonByTable.get(table.id)} basePath={basePath} />
        ))}
        {(tables?.data.length ?? 0) === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No tables in this area yet.</p>}
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
    <div className="absolute w-28 -translate-x-1/2 -translate-y-1/2" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
      <TableCard table={table} arrivingAt={arrivingAt} basePath={basePath} />
    </div>
  )
}


"use client"

import { useQueries } from "@tanstack/react-query"

import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api/client"
import { queryKeys } from "@/lib/query-keys"
import { useDiningAreas } from "@/hooks/use-dining-areas"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { useReservations, type ReservationTableAssignment } from "@/hooks/use-reservations"
import { TableCard } from "./table-card"

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
  const arrivingSoonByTable = useArrivingSoonByTable(outletId)

  return (
    <div className="space-y-6">
      {isLoading && <Skeleton className="h-48 w-full" />}
      {!isLoading && (areas?.data.length ?? 0) === 0 && (
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
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{areaName}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tables?.data.map((table) => (
          <TableCard key={table.id} table={table} arrivingAt={arrivingSoonByTable.get(table.id)} basePath={basePath} />
        ))}
      </div>
    </div>
  )
}

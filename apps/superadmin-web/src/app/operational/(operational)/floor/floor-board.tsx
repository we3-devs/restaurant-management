"use client"

import { useEffect, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { GripIcon, LayoutGridIcon, RotateCcwIcon } from "lucide-react"

import { Skeleton } from "@rms/ui/skeleton"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { apiClient } from "@rms/api-client/client"
import { queryKeys } from "@rms/api-client/query-keys"
import { useDiningAreas } from "@rms/api-client/hooks/use-dining-areas"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useReservations, type ReservationTableAssignment } from "@rms/api-client/hooks/use-reservations"
import { TableCard } from "./table-card"
import { Button } from "@rms/ui/button"
import { cn } from "@rms/ui/cn"
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
  const [arrangeMode, setArrangeMode] = useState(false)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [hydrated, setHydrated] = useState(false)
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)
  const arrivingSoonByTable = useArrivingSoonByTable(outletId)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(`rms-floor-layout:${outletId}`)
        setPositions(saved ? JSON.parse(saved) : {})
      } catch {
        setPositions({})
      }
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [outletId])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(`rms-floor-layout:${outletId}`, JSON.stringify(positions))
  }, [hydrated, outletId, positions])

  function updatePosition(tableId: number, position: { x: number; y: number }) {
    setPositions((current) => ({ ...current, [tableId]: position }))
  }

  function resetLayout() {
    setPositions({})
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <LayoutGridIcon className="size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Floor map</p>
            <p className="text-xs text-muted-foreground">
              {arrangeMode ? "Drag tables to place them on the floor." : "Tap a table to start a sale."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {arrangeMode && Object.keys(positions).length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetLayout}>
              <RotateCcwIcon /> Reset
            </Button>
          )}
          <Button variant={arrangeMode ? "default" : "outline"} size="sm" onClick={() => setArrangeMode((value) => !value)}>
            <GripIcon /> {arrangeMode ? "Done arranging" : "Arrange floor"}
          </Button>
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
          arrangeMode={arrangeMode}
          positions={positions}
          onPositionChange={updatePosition}
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
  arrangeMode,
  positions,
  onPositionChange,
}: {
  outletId: number
  areaId: number
  areaName: string
  arrivingSoonByTable: Map<number, string>
  basePath?: string
  arrangeMode: boolean
  positions: Record<string, { x: number; y: number }>
  onPositionChange: (tableId: number, position: { x: number; y: number }) => void
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
          arrangeMode ? (
            <DraggableTable
              key={table.id}
              table={table}
              index={index}
              position={positions[table.id]}
              onPositionChange={onPositionChange}
            />
          ) : (
            <MapTable key={table.id} table={table} index={index} position={positions[table.id]} arrivingAt={arrivingSoonByTable.get(table.id)} basePath={basePath} />
          )
        ))}
        {(tables?.data.length ?? 0) === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No tables in this area yet.</p>}
      </div>
    </section>
  )
}

const TABLE_STYLES: Record<string, string> = {
  available: "border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  occupied: "border-destructive/70 bg-destructive/15 text-destructive",
  reserved: "border-amber-500/70 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  cleaning: "border-muted-foreground/40 bg-muted text-muted-foreground",
  inactive: "border-muted-foreground/30 bg-muted/60 text-muted-foreground opacity-60",
}

function getPosition(index: number, position?: { x: number; y: number }) {
  if (position) return position
  return { x: 12 + (index % 4) * 23, y: 18 + Math.floor(index / 4) * 30 }
}

function MapTable({ table, index, position, arrivingAt, basePath }: { table: DiningTable; index: number; position?: { x: number; y: number }; arrivingAt?: string; basePath?: string }) {
  const point = getPosition(index, position)
  return (
    <div className="absolute w-28 -translate-x-1/2 -translate-y-1/2" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
      <TableCard table={table} arrivingAt={arrivingAt} basePath={basePath} />
    </div>
  )
}

function DraggableTable({ table, index, position, onPositionChange }: { table: DiningTable; index: number; position?: { x: number; y: number }; onPositionChange: (tableId: number, position: { x: number; y: number }) => void }) {
  const [dragging, setDragging] = useState(false)
  const point = getPosition(index, position)

  function move(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return
    const board = event.currentTarget.parentElement
    if (!board) return
    const bounds = board.getBoundingClientRect()
    onPositionChange(table.id, {
      x: Math.max(7, Math.min(93, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(10, Math.min(90, ((event.clientY - bounds.top) / bounds.height) * 100)),
    })
  }

  return (
    <button
      type="button"
      className={cn("absolute w-28 -translate-x-1/2 -translate-y-1/2 touch-none rounded-xl border-2 px-2 py-3 text-center shadow-sm transition-shadow", TABLE_STYLES[table.status] ?? TABLE_STYLES.available, dragging && "z-10 scale-105 shadow-lg ring-2 ring-primary/30")}
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true) }}
      onPointerMove={move}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <GripIcon className="mx-auto mb-1 size-4 opacity-50" />
      <span className="block text-sm font-semibold">{table.name}</span>
      <span className="mt-0.5 block text-[11px] capitalize opacity-75">{table.status} · {table.capacity} seats</span>
    </button>
  )
}

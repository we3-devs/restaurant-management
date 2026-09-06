"use client"

import { useEffect, useState } from "react"
import { ArmchairIcon, GripIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@rms/ui/button"
import { cn } from "@rms/ui/cn"
import { Badge } from "@rms/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@rms/ui/alert-dialog"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useDiningAreas } from "@rms/api-client/hooks/use-dining-areas"
import { useDeleteDiningArea } from "@rms/api-client/hooks/use-dining-areas"
import { useDiningTables, type DiningTable } from "@rms/api-client/hooks/use-dining-tables"
import { useCurrentUser } from "@rms/auth/current-user-context"
import { usePageTitle } from "@rms/ui/use-page-title"
import { CreateDiningTableDialog } from "../tables/create-dining-table-dialog"
import { CreateDiningAreaDialog } from "./create-dining-area-dialog"

type Point = { x: number; y: number }
const STATUS_STYLES: Record<string, string> = {
  available: "border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  occupied: "border-destructive/70 bg-destructive/15 text-destructive",
  reserved: "border-amber-500/70 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  cleaning: "border-muted-foreground/40 bg-muted text-muted-foreground",
  inactive: "border-muted-foreground/30 bg-muted/60 text-muted-foreground opacity-60",
}

export default function FloorPlanPage() {
  const { outletId } = useActiveOutlet()
  const { isSuperadmin } = useCurrentUser()
  const [arrangeMode, setArrangeMode] = useState(false)
  const [positions, setPositions] = useState<Record<number, Point>>({})
  const [hydrated, setHydrated] = useState(false)
  const { data: areas, isLoading } = useDiningAreas({ outletId: outletId ?? undefined, limit: 100 })

  usePageTitle("Floor Plan")

  useEffect(() => {
    if (!outletId) return
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(`rms-dashboard-floor-layout:${outletId}`)
        setPositions(saved ? JSON.parse(saved) : {})
      } catch {
        setPositions({})
      }
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [outletId])

  useEffect(() => {
    if (hydrated && outletId) window.localStorage.setItem(`rms-dashboard-floor-layout:${outletId}`, JSON.stringify(positions))
  }, [hydrated, outletId, positions])

  if (!outletId) return <p className="text-sm text-muted-foreground">Select an outlet to design its floor plan.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Floor Plan</h1>
          <p className="text-sm text-muted-foreground">Arrange dining areas and tables visually for this outlet.</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperadmin && <CreateDiningAreaDialog />}
          <CreateDiningTableDialog />
          {arrangeMode && Object.keys(positions).length > 0 && <Button variant="ghost" size="sm" onClick={() => setPositions({})}><RotateCcwIcon /> Reset</Button>}
          <Button variant={arrangeMode ? "default" : "outline"} size="sm" onClick={() => setArrangeMode((value) => !value)}>
            <GripIcon /> {arrangeMode ? "Done arranging" : "Arrange floor"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" /> Reserved</span>
        <span className="ml-auto">{arrangeMode ? "Drag tables to position them on the map." : "Use this map to plan your dining room."}</span>
      </div>

      {isLoading && <div className="h-80 animate-pulse rounded-xl border bg-muted/30" />}
      {!isLoading && (areas?.data.length ?? 0) === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Create a dining area first, then place its tables here.</p>}
      <div className="space-y-5">
        {areas?.data.map((area) => <AreaMap key={area.id} outletId={outletId} area={area} isSuperadmin={isSuperadmin} arrangeMode={arrangeMode} positions={positions} onPositionChange={(tableId, point) => setPositions((current) => ({ ...current, [tableId]: point }))} />)}
      </div>
    </div>
  )
}

function AreaMap({ outletId, area, isSuperadmin, arrangeMode, positions, onPositionChange }: { outletId: number; area: { id: number; name: string; code: string | null; isActive: boolean }; isSuperadmin: boolean; arrangeMode: boolean; positions: Record<number, Point>; onPositionChange: (tableId: number, point: Point) => void }) {
  const { data: tables } = useDiningTables({ outletId, diningAreaId: area.id, limit: 100 })
  const deleteArea = useDeleteDiningArea()

  async function handleDelete() {
    try {
      await deleteArea.mutateAsync(area.id)
      toast.success(`Dining area "${area.name}" deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete dining area")
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{area.name}</h2>{area.code && <span className="text-xs text-muted-foreground">{area.code}</span>}{!area.isActive && <Badge variant="destructive">inactive</Badge>}</div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{tables?.data.length ?? 0} tables</span>{isSuperadmin && <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" size="xs">Delete area</Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete dining area &quot;{area.name}&quot;?</AlertDialogTitle><AlertDialogDescription>This permanently deletes any tables under this area too. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></div>
      <div className="relative h-[360px] overflow-hidden rounded-xl border bg-muted/20 [background-image:linear-gradient(to_right,hsl(var(--border)/.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/.35)_1px,transparent_1px)] [background-size:32px_32px]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-amber-500/[0.05]" />
        {(tables?.data ?? []).map((table, index) => <MapTable key={table.id} table={table} index={index} arrangeMode={arrangeMode} position={positions[table.id]} onPositionChange={onPositionChange} />)}
        {(tables?.data.length ?? 0) === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No tables in this area yet.</p>}
      </div>
    </section>
  )
}

function MapTable({ table, index, arrangeMode, position, onPositionChange }: { table: DiningTable; index: number; arrangeMode: boolean; position?: Point; onPositionChange: (tableId: number, point: Point) => void }) {
  const [dragging, setDragging] = useState(false)
  const point = position ?? { x: 12 + (index % 4) * 23, y: 18 + Math.floor(index / 4) * 30 }

  function move(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return
    const board = event.currentTarget.parentElement
    if (!board) return
    const bounds = board.getBoundingClientRect()
    onPositionChange(table.id, { x: Math.max(7, Math.min(93, ((event.clientX - bounds.left) / bounds.width) * 100)), y: Math.max(10, Math.min(90, ((event.clientY - bounds.top) / bounds.height) * 100)) })
  }

  return (
    <button type="button" className={cn("absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-2 py-3 text-center shadow-sm transition-shadow", STATUS_STYLES[table.status] ?? STATUS_STYLES.available, arrangeMode && "touch-none", dragging && "z-10 scale-105 shadow-lg ring-2 ring-primary/30")} style={{ left: `${point.x}%`, top: `${point.y}%` }} onPointerDown={arrangeMode ? (event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true) } : undefined} onPointerMove={arrangeMode ? move : undefined} onPointerUp={arrangeMode ? () => setDragging(false) : undefined} onPointerCancel={arrangeMode ? () => setDragging(false) : undefined}>
      {arrangeMode ? <GripIcon className="mx-auto mb-1 size-4 opacity-50" /> : <ArmchairIcon className="mx-auto mb-1 size-4 opacity-60" />}
      <span className="block text-sm font-semibold">{table.name}</span>
      <span className="mt-0.5 block text-[11px] capitalize opacity-75">{table.status} · {table.capacity} seats</span>
    </button>
  )
}

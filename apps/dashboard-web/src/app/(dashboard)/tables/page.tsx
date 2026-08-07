"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useDiningAreas } from "@/hooks/use-dining-areas"
import { useDiningTables, type DiningTable } from "@/hooks/use-dining-tables"
import { TableDetailDialog } from "./table-detail-dialog"

const STATUS_STYLES: Record<string, string> = {
  available: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  occupied: "border-destructive bg-destructive/10 text-destructive",
  reserved: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cleaning: "border-muted bg-muted text-muted-foreground",
  inactive: "border-muted bg-muted/50 text-muted-foreground opacity-60",
}

/** Read-only mirror of operational-web's floor board — monitoring only, no table actions live here. */
export default function TablesPage() {
  const { outletId } = useActiveOutlet()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tables</h1>
      </div>

      {outletId ? (
        <FloorOverview outletId={outletId} />
      ) : (
        <p className="text-sm text-muted-foreground">Select an outlet.</p>
      )}
    </div>
  )
}

function FloorOverview({ outletId }: { outletId: number }) {
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if ((areas?.data.length ?? 0) === 0) {
    return <p className="text-sm text-muted-foreground">No dining areas configured for this outlet.</p>
  }

  return (
    <div className="space-y-6">
      {areas?.data.map((area) => (
        <AreaSection key={area.id} outletId={outletId} areaId={area.id} areaName={area.name} />
      ))}
    </div>
  )
}

function AreaSection({ outletId, areaId, areaName }: { outletId: number; areaId: number; areaName: string }) {
  const { data: tables } = useDiningTables({ outletId, diningAreaId: areaId, limit: 100 })

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{areaName}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tables?.data.map((table) => (
          <TableStatusCard key={table.id} table={table} />
        ))}
      </div>
    </div>
  )
}

function TableStatusCard({ table }: { table: DiningTable }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-4 text-center transition-colors hover:opacity-80",
          STATUS_STYLES[table.status] ?? STATUS_STYLES.available,
        )}
      >
        <span className="text-sm font-semibold">{table.name}</span>
        <span className="text-xs capitalize">{table.status}</span>
        <span className="text-xs opacity-75">seats {table.capacity}</span>
      </button>
      {open && <TableDetailDialog table={table} onClose={() => setOpen(false)} />}
    </>
  )
}

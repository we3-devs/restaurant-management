"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useDiningAreas } from "@/hooks/use-dining-areas"
import { useDiningTables, type DiningTable } from "@/hooks/use-dining-tables"
import { CreateDiningTableDialog } from "./create-dining-table-dialog"
import { TableDetailDialog } from "./table-detail-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

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
  // Overview pages are monitoring-only. Provisioning is handled elsewhere.
  const { isSuperadmin } = useCurrentUser()

  usePageTitle("Tables")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tables</h1>
        {isSuperadmin && <CreateDiningTableDialog />}
      </div>

      {outletId ? (
        <FloorOverview outletId={outletId} isSuperadmin={isSuperadmin} />
      ) : (
        <p className="text-sm text-muted-foreground">Select an outlet.</p>
      )}
    </div>
  )
}

function FloorOverview({ outletId, isSuperadmin }: { outletId: number; isSuperadmin: boolean }) {
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }
  if ((areas?.data.length ?? 0) === 0) {
    return <p className="text-sm text-muted-foreground">No dining areas configured for this outlet.</p>
  }

  return (
    <div className="space-y-6">
      {areas?.data.map((area) => (
        <AreaSection
          key={area.id}
          outletId={outletId}
          areaId={area.id}
          areaName={area.name}
          isSuperadmin={isSuperadmin}
        />
      ))}
    </div>
  )
}

function AreaSection({
  outletId,
  areaId,
  areaName,
  isSuperadmin,
}: {
  outletId: number
  areaId: number
  areaName: string
  isSuperadmin: boolean
}) {
  const { data: tables } = useDiningTables({ outletId, diningAreaId: areaId, limit: 100 })

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{areaName}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tables?.data.map((table) => (
          <TableStatusCard key={table.id} table={table} isSuperadmin={isSuperadmin} />
        ))}
      </div>
    </div>
  )
}

function TableStatusCard({ table, isSuperadmin }: { table: DiningTable; isSuperadmin: boolean }) {
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
      {open && (
        <TableDetailDialog table={table} isSuperadmin={isSuperadmin} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

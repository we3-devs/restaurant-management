"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { useDiningAreas } from "@/hooks/use-dining-areas"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { ReservationsPanel } from "./reservations-panel"
import { TableCard } from "./table-card"

export function FloorBoard({ outletId }: { outletId: number }) {
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })

  return (
    <div className="space-y-6">
      <ReservationsPanel outletId={outletId} />

      {isLoading && <Skeleton className="h-48 w-full" />}
      {!isLoading && (areas?.data.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">No dining areas configured for this outlet.</p>
      )}
      {areas?.data.map((area) => <AreaSection key={area.id} outletId={outletId} areaId={area.id} areaName={area.name} />)}
    </div>
  )
}

function AreaSection({ outletId, areaId, areaName }: { outletId: number; areaId: number; areaName: string }) {
  const { data: tables } = useDiningTables({ outletId, diningAreaId: areaId, limit: 100 })

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{areaName}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tables?.data.map((table) => <TableCard key={table.id} table={table} />)}
      </div>
    </div>
  )
}

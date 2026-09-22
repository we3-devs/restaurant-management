"use client"

import { Badge } from "@rms/ui/badge"
import { Skeleton } from "@rms/ui/skeleton"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useDiningAreas } from "@rms/api-client/hooks/use-dining-areas"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { usePageTitle } from "@rms/ui/use-page-title"

/** Read-only mirror of Floor Management's dining areas — monitoring only, no create/edit/delete here. */
export default function ViewDiningAreasPage() {
  const { outletId } = useActiveOutlet()

  usePageTitle("Dining Areas")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dining Areas</h1>
      </div>

      {outletId ? <AreaOverview outletId={outletId} /> : <p className="text-sm text-muted-foreground">Select an outlet.</p>}
    </div>
  )
}

function AreaOverview({ outletId }: { outletId: number }) {
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }
  if ((areas?.data.length ?? 0) === 0) {
    return <p className="text-sm text-muted-foreground">No dining areas configured for this outlet.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {areas?.data.map((area) => <AreaCard key={area.id} outletId={outletId} areaId={area.id} name={area.name} code={area.code} isActive={area.isActive} />)}
    </div>
  )
}

function AreaCard({
  outletId,
  areaId,
  name,
  code,
  isActive,
}: {
  outletId: number
  areaId: number
  name: string
  code: string | null
  isActive: boolean
}) {
  const { data: tables } = useDiningTables({ outletId, diningAreaId: areaId, limit: 100 })

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-muted bg-muted/20 p-4 text-center">
      <span className="text-sm font-semibold">{name}</span>
      {code && <span className="text-xs text-muted-foreground">{code}</span>}
      <span className="text-xs opacity-75">{tables?.data.length ?? 0} tables</span>
      {!isActive && (
        <Badge variant="destructive" className="mt-1">
          inactive
        </Badge>
      )}
    </div>
  )
}

"use client"

import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { cn } from "@/lib/utils"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useDeleteDiningArea, useDiningAreas, type DiningArea } from "@/hooks/use-dining-areas"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { usePageTitle } from "@rms/ui/use-page-title"
import { CreateDiningAreaDialog } from "./create-dining-area-dialog"

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  occupied: "bg-destructive",
  reserved: "bg-amber-500",
  cleaning: "bg-muted-foreground",
}

/** Read-only mirror of operational-web's dining areas — monitoring only, with superadmin-only provisioning. */
export default function DiningAreasPage() {
  const { outletId } = useActiveOutlet()
  const { isSuperadmin } = useCurrentUser()

  usePageTitle("Dining Areas")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dining Areas</h1>
        {isSuperadmin && <CreateDiningAreaDialog />}
      </div>

      {outletId ? (
        <AreaList outletId={outletId} isSuperadmin={isSuperadmin} />
      ) : (
        <p className="text-sm text-muted-foreground">Select an outlet.</p>
      )}
    </div>
  )
}

function AreaList({ outletId, isSuperadmin }: { outletId: number; isSuperadmin: boolean }) {
  const { data: areas, isLoading } = useDiningAreas({ outletId, limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)

  if (showSkeleton) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }
  if ((areas?.data.length ?? 0) === 0) {
    return <p className="text-sm text-muted-foreground">No dining areas configured for this outlet.</p>
  }

  return (
    <div className="space-y-3">
      {areas?.data.map((area) => (
        <AreaRow key={area.id} area={area} outletId={outletId} isSuperadmin={isSuperadmin} />
      ))}
    </div>
  )
}

function AreaRow({
  area,
  outletId,
  isSuperadmin,
}: {
  area: DiningArea
  outletId: number
  isSuperadmin: boolean
}) {
  const { data: tables } = useDiningTables({ outletId, diningAreaId: area.id, limit: 100 })
  const deleteArea = useDeleteDiningArea()

  const rows = tables?.data ?? []
  const counts = {
    available: rows.filter((t) => t.status === "available").length,
    occupied: rows.filter((t) => t.status === "occupied").length,
    reserved: rows.filter((t) => t.status === "reserved").length,
    cleaning: rows.filter((t) => t.status === "cleaning").length,
  }

  async function handleDelete() {
    try {
      await deleteArea.mutateAsync(area.id)
      toast.success(`Dining area "${area.name}" deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete dining area")
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{area.name}</span>
          {area.code && <span className="text-xs text-muted-foreground">{area.code}</span>}
          {!area.isActive && <Badge variant="destructive">inactive</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {rows.length} table{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {(["available", "occupied", "reserved", "cleaning"] as const).map((status) => (
          <span key={status} className="flex items-center gap-1 capitalize">
            <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
            {counts[status]}
          </span>
        ))}
      </div>

      {isSuperadmin && (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete dining area &quot;{area.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes any tables under this area too (no soft delete). This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

"use client"

import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { FloorBoard } from "@/app/operational/(operational)/floor/floor-board"

/** Staff floor plan and order-taking entry point. */
export default function StaffTablesPage() {
  const { outletId } = useActiveOutlet()

  return (
    <div className="flex flex-1 flex-col gap-3">
      <h1 className="text-lg font-semibold">Tables</h1>
      {!outletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : (
        <FloorBoard outletId={outletId} basePath="/operational/staff/pos" />
      )}
    </div>
  )
}

"use client"

import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { FloorBoard } from "@/app/(dashboard)/floor/floor-board"

/** Same FloorBoard the desktop /floor and /pos pages use — only the tap target differs (staff order-taking route instead of /pos). */
export default function StaffTablesPage() {
  const { outletId } = useActiveOutlet()

  return (
    <div className="flex flex-1 flex-col gap-3">
      <h1 className="text-lg font-semibold">Tables</h1>
      {!outletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : (
        <FloorBoard outletId={outletId} basePath="/staff/waiter/pos" />
      )}
    </div>
  )
}

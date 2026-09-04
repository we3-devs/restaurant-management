"use client"

import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { FloorBoard } from "./floor-board"

export default function FloorPage() {
  const { outletId } = useActiveOutlet()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Floor</h1>
      </div>

      {outletId ? (
        <FloorBoard outletId={outletId} />
      ) : (
        <p className="text-sm text-muted-foreground">Select an outlet.</p>
      )}
    </div>
  )
}

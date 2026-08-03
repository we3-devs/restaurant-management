"use client"

import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { ReadyQueue } from "@/app/(dashboard)/service/ready-queue"

/** Reuses the desktop ReadyQueue component as-is — it has no dashboard-shell coupling, just outletId in, cards out. */
export default function StaffReadyQueuePage() {
  const { outletId } = useActiveOutlet()

  return (
    <div className="flex flex-1 flex-col gap-3">
      <h1 className="text-lg font-semibold">Ready to deliver</h1>
      {!outletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : (
        <ReadyQueue outletId={outletId} />
      )}
    </div>
  )
}

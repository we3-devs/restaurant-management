"use client"

import { BellRingIcon, PackageCheckIcon } from "lucide-react"

import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { ReadyQueue } from "@/app/(operational)/service/ready-queue"
import { ServiceRequestsPanel } from "@/app/(operational)/service/service-requests-panel"

/**
 * Reuses the desktop ReadyQueue/ServiceRequestsPanel as-is — neither has any
 * dashboard-shell coupling, just outletId in, cards out. Split 50/50 instead
 * of the desktop's side-by-side grid since the staff shell is mobile-width;
 * each half scrolls independently (basis-1/2 + min-h-0 + overflow-y-auto) so
 * a long list on one side never pushes the other side off-screen.
 */
export default function StaffQueuePage() {
  const { outletId } = useActiveOutlet()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h1 className="text-lg font-semibold">Queue</h1>
      {!outletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <section className="flex min-h-0 flex-1 basis-1/2 flex-col gap-2">
            <SectionHeader icon={<PackageCheckIcon className="size-4" />} title="Ready to deliver" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ReadyQueue outletId={outletId} />
            </div>
          </section>

          <section className="flex min-h-0 flex-1 basis-1/2 flex-col gap-2 border-t border-border pt-3">
            <SectionHeader icon={<BellRingIcon className="size-4" />} title="Service requests" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ServiceRequestsPanel outletId={outletId} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground">
      {icon}
      {title}
    </h2>
  )
}

"use client"

import Link from "next/link"
import { BellRingIcon, PackageCheckIcon, QrCodeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useKitchenRealtime } from "@/hooks/use-kitchen-realtime"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { ReadyQueue } from "./ready-queue"
import { ServiceRequestsPanel } from "./service-requests-panel"

export default function ServicePage() {
  const { outletId: effectiveOutletId } = useActiveOutlet()

  // Pushes ready notifications, service requests and kitchen status changes —
  // the same /kds socket the kitchen board and POS use.
  useKitchenRealtime(effectiveOutletId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Service</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/floor" />}>
            Floor
          </Button>
        </div>
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="space-y-3">
            <SectionHeader icon={<PackageCheckIcon />} title="Ready Queue" hint="Deliver these to the tables" />
            <ReadyQueue outletId={effectiveOutletId} />
          </section>

          <section className="space-y-3">
            <SectionHeader icon={<BellRingIcon />} title="Service Requests" hint="Guest &amp; staff call-waiter requests" />
            <ServiceRequestsPanel outletId={effectiveOutletId} />
          </section>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

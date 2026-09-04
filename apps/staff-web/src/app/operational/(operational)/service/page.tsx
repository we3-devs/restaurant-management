"use client"

import Link from "next/link"
import { useState } from "react"
import { BellRingIcon, PackageCheckIcon, QrCodeIcon } from "lucide-react"

import { Button } from "@rms/ui/button"
import { useKitchenRealtime } from "@rms/api-client/hooks/use-kitchen-realtime"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { ReadyQueue } from "./ready-queue"
import { ServiceRequestsPanel } from "./service-requests-panel"

export default function ServicePage() {
  const { outletId: effectiveOutletId } = useActiveOutlet()
  const [tab, setTab] = useState<"ready" | "requests">("ready")

  // Pushes ready notifications, service requests and kitchen status changes —
  // the same /kds socket the kitchen board and POS use.
  useKitchenRealtime(effectiveOutletId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Service</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/operational/floor" />}>
            Floor
          </Button>
        </div>
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid max-w-xl grid-cols-2 gap-1.5 rounded-xl border bg-muted/40 p-1.5">
            <TabButton active={tab === "ready"} onClick={() => setTab("ready")}><PackageCheckIcon className="size-4" />Ready Queue</TabButton>
            <TabButton active={tab === "requests"} onClick={() => setTab("requests")}><BellRingIcon className="size-4" />Service Requests</TabButton>
          </div>
          {tab === "ready" ? <ReadyQueue outletId={effectiveOutletId} /> : <ServiceRequestsPanel outletId={effectiveOutletId} />}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-all ${active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/70"}`}>{children}</button>
}

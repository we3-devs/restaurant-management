"use client"

import { useState } from "react"
import { BellRingIcon, PackageCheckIcon } from "lucide-react"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useKitchenRealtime } from "@rms/api-client/hooks/use-kitchen-realtime"
import { ReadyQueue } from "@/app/operational/(operational)/service/ready-queue"
import { ServiceRequestsPanel } from "@/app/operational/(operational)/service/service-requests-panel"

export default function StaffQueuePage() {
  const { outletId } = useActiveOutlet()
  const [tab, setTab] = useState<"ready" | "requests">("ready")
  useKitchenRealtime(outletId)
  return <div className="flex min-h-0 flex-1 flex-col gap-3"><h1 className="text-lg font-semibold">Queue</h1>{!outletId ? <p className="text-sm text-muted-foreground">Select an outlet to start.</p> : <div className="flex min-h-0 flex-1 flex-col gap-3"><div className="grid grid-cols-2 gap-1.5 rounded-xl border bg-muted/40 p-1.5"><TabButton active={tab === "ready"} onClick={() => setTab("ready")}><PackageCheckIcon className="size-4" />Ready to deliver</TabButton><TabButton active={tab === "requests"} onClick={() => setTab("requests")}><BellRingIcon className="size-4" />Service requests</TabButton></div><div className="min-h-0 flex-1 overflow-y-auto">{tab === "ready" ? <ReadyQueue outletId={outletId} /> : <ServiceRequestsPanel outletId={outletId} />}</div></div>}</div>
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-all ${active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/70"}`}>{children}</button> }

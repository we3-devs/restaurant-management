"use client"

import { BellRingIcon, CheckIcon, DropletIcon, HandIcon, ReceiptIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Card } from "@rms/ui/card"
import { ListSkeleton } from "@rms/ui/skeletons"
import {
  useResolveServiceRequest,
  useServiceRequests,
  type ServiceRequest,
  type ServiceRequestType,
} from "@rms/api-client/hooks/use-service-requests"

const TYPE_ICONS: Record<ServiceRequestType, typeof DropletIcon> = {
  water: DropletIcon,
  bill: ReceiptIcon,
  assistance: HandIcon,
  other: BellRingIcon,
}

function elapsedMinutes(since: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60_000))
}

export function ServiceRequestsPanel({ outletId }: { outletId: number }) {
  const { data, isLoading } = useServiceRequests({ outletId, status: "pending", limit: 100 })

  const open = data?.data ?? []

  if (isLoading) {
    return <ListSkeleton count={2} />
  }

  if (open.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
        <BellRingIcon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No open requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {open.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  )
}

function RequestCard({ request }: { request: ServiceRequest }) {
  const resolve = useResolveServiceRequest()
  const Icon = TYPE_ICONS[request.type] ?? BellRingIcon
  const tableName = request.diningTable?.name ?? `Table ${request.diningTableId}`

  async function handleResolve() {
    try {
      await resolve.mutateAsync(request.id)
      toast.success(`${tableName} request resolved`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve request")
    }
  }

  return (
    <Card className="flex-row items-center gap-3 p-3.5 ring-1 ring-sky-500/30">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{tableName}</p>
          <Badge variant="outline" className="capitalize">{request.type.replace("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground">{elapsedMinutes(request.createdAt)}m ago</span>
        </div>
        {request.note && <p className="truncate text-sm text-muted-foreground">{request.note}</p>}
      </div>
      <Button size="sm" variant="secondary" disabled={resolve.isPending} onClick={handleResolve}>
        <CheckIcon />
        {resolve.isPending ? "Resolving..." : "Resolved"}
      </Button>
    </Card>
  )
}

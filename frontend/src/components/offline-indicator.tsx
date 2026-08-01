"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CloudOffIcon, RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useOnlineStatus } from "@/lib/offline/online-status"
import { replayQueuedMutations, useQueuedMutationCount } from "@/lib/offline/mutation-queue"

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  const queuedCount = useQueuedMutationCount()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isOnline) void replayQueuedMutations(queryClient)
  }, [isOnline, queryClient])

  if (isOnline && queuedCount === 0) return null

  return (
    <Badge
      variant="outline"
      className={
        isOnline
          ? "gap-1.5 border-primary/40 text-primary"
          : "gap-1.5 border-destructive/40 text-destructive"
      }
    >
      {isOnline ? <RefreshCwIcon className="size-3.5 animate-spin" /> : <CloudOffIcon className="size-3.5" />}
      {isOnline ? `Syncing ${queuedCount} change${queuedCount === 1 ? "" : "s"}...` : "Offline"}
    </Badge>
  )
}

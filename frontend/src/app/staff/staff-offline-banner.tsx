"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CloudOffIcon, RefreshCwIcon } from "lucide-react"

import { useOnlineStatus } from "@/lib/offline/online-status"
import { replayQueuedMutations, useQueuedMutationCount } from "@/lib/offline/mutation-queue"
import { cn } from "@/lib/utils"

/**
 * Same offline/queue hooks as <OfflineIndicator/> (desktop header badge) —
 * kitchen wifi is expected to be spotty, so this renders as a full-width
 * banner instead of a small badge, per the mobile UX requirement.
 */
export function StaffOfflineBanner() {
  const isOnline = useOnlineStatus()
  const queuedCount = useQueuedMutationCount()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isOnline) void replayQueuedMutations(queryClient)
  }, [isOnline, queryClient])

  if (isOnline && queuedCount === 0) return null

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium",
        isOnline ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
      )}
      role="status"
    >
      {isOnline ? <RefreshCwIcon className="size-4 animate-spin" /> : <CloudOffIcon className="size-4" />}
      {isOnline
        ? `Syncing ${queuedCount} pending update${queuedCount === 1 ? "" : "s"}...`
        : queuedCount > 0
          ? `Offline — ${queuedCount} update${queuedCount === 1 ? "" : "s"} pending sync`
          : "Offline — changes will sync when reconnected"}
    </div>
  )
}

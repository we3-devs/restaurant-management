"use client"

import { useEffect, useState } from "react"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"

export function RealtimeIndicator() {
  const isOnline = useOnlineStatus()
  const [, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 z-50">
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-background border border-border shadow-sm">
        <div
          className={`w-2 h-2 rounded-full transition-colors ${
            isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
          aria-label={isOnline ? "Online" : "Offline"}
        />
        <span className="text-xs font-medium text-muted-foreground">
          {isOnline ? "Live" : "Offline"}
        </span>
      </div>
    </div>
  )
}

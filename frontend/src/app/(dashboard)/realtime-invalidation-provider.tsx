"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"

import { connectKdsSocket } from "@/lib/realtime/kds-socket"
import { RESOURCE_QUERY_MAP } from "@/lib/realtime/resource-query-map"
import { useOutlets } from "@/hooks/use-outlets"

interface ResourceChangedPayload {
  resource: string
  action: "created" | "updated" | "deleted"
  outletId: number | null
}

/**
 * Mounted once at the dashboard root. Joins every outlet room the user has
 * access to and invalidates the matching query keys on every
 * `resource.changed` broadcast (see backend RealtimeChangeSubscriber) — this
 * is what makes every list view in the app live without each page wiring
 * its own socket listener.
 */
export function RealtimeInvalidationProvider() {
  const queryClient = useQueryClient()
  const { data: outlets } = useOutlets({ limit: 100 })
  const outletIds = outlets?.data.map((o) => o.id).join(",") ?? ""

  useEffect(() => {
    if (!outletIds) return

    let socket: Socket | undefined
    let cancelled = false

    connectKdsSocket()
      .then((s) => {
        if (cancelled) {
          s.disconnect()
          return
        }
        socket = s
        socket.on("connect", () => {
          for (const idStr of outletIds.split(",")) {
            socket?.emit("subscribe-outlet", { outletId: Number(idStr) })
          }
        })
        socket.on("resource.changed", (payload: ResourceChangedPayload) => {
          const keys = RESOURCE_QUERY_MAP[payload.resource]
          if (!keys) return
          for (const queryKey of keys) {
            queryClient.invalidateQueries({ queryKey })
          }
        })
      })
      .catch(() => {
        // Realtime is a nice-to-have — pages still refetch on their own staleTime/mount.
      })

    return () => {
      cancelled = true
      socket?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletIds])

  return null
}

"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { acquireKdsSocket, releaseKdsSocket } from "@/lib/realtime/kds-socket"
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

    const socket = acquireKdsSocket()
    const subscribe = () => {
      for (const idStr of outletIds.split(",")) {
        socket.emit("subscribe-outlet", { outletId: Number(idStr) })
      }
    }
    const onResourceChanged = (payload: ResourceChangedPayload) => {
      const keys = RESOURCE_QUERY_MAP[payload.resource]
      if (!keys) return
      for (const queryKey of keys) {
        queryClient.invalidateQueries({ queryKey })
      }
    }

    socket.on("connect", subscribe)
    socket.on("resource.changed", onResourceChanged)
    if (socket.connected) subscribe()

    return () => {
      socket.off("connect", subscribe)
      socket.off("resource.changed", onResourceChanged)
      releaseKdsSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletIds])

  return null
}

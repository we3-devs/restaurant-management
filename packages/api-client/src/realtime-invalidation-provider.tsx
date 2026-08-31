"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { acquireKdsSocket, releaseKdsSocket } from "./realtime/kds-socket"
import { RESOURCE_QUERY_MAP } from "./realtime/resource-query-map"
import { useActiveOutlet } from "./outlet/active-outlet-context"

interface ResourceChangedPayload {
  resource: string
  action: "created" | "updated" | "deleted"
  outletId: number | null
}

type ResourceChangedBatch = ResourceChangedPayload[]

/**
 * Mounted once at the dashboard root. Joins every outlet room the user has
 * access to and invalidates the matching query keys on every
 * `resource.changed` broadcast (see backend RealtimeChangeSubscriber) — this
 * is what makes every list view in the app live without each page wiring
 * its own socket listener.
 *
 * Reuses ActiveOutletProvider's outlet list instead of fetching its own:
 * that hook already resolves the correct source per role (`/outlets` for
 * superadmins, `/outlets/assigned` — which non-superadmins are actually
 * permitted to call — for everyone else), so calling `useOutlets` directly
 * here would both duplicate the request and 403 for non-superadmins.
 */
export function RealtimeInvalidationProvider() {
  const queryClient = useQueryClient()
  const { outlets } = useActiveOutlet()
  const outletIds = outlets.map((o) => o.id).join(",")
  const subscribedOutletIds = new Set(outlets.map((o) => o.id))

  useEffect(() => {
    if (!outletIds) return

    const socket = acquireKdsSocket()
    const subscribe = () => {
      for (const idStr of outletIds.split(",")) {
        socket.emit("subscribe-outlet", { outletId: Number(idStr) })
      }
    }
    const invalidate = (payload: ResourceChangedPayload) => {
      // The server normally scopes outlet events by room. Keep this guard as
      // a second boundary for global/shared sockets and future transports.
      if (payload.outletId !== null && !subscribedOutletIds.has(payload.outletId)) return
      const keys = RESOURCE_QUERY_MAP[payload.resource]
      if (!keys) return
      for (const queryKey of keys) {
        queryClient.invalidateQueries({ queryKey })
      }
    }
    const onResourceChanged = (payload: ResourceChangedPayload) => invalidate(payload)
    const onResourceChangedBatch = (payload: ResourceChangedBatch) => {
      for (const change of payload) invalidate(change)
    }

    socket.on("connect", subscribe)
    socket.on("resource.changed", onResourceChanged)
    socket.on("resource.changed.batch", onResourceChangedBatch)
    if (socket.connected) subscribe()

    return () => {
      socket.off("connect", subscribe)
      socket.off("resource.changed", onResourceChanged)
      socket.off("resource.changed.batch", onResourceChangedBatch)
      releaseKdsSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletIds])

  return null
}

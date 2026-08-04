"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/api/client"
import { queryKeys } from "@/lib/query-keys"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { hasRoutePermission } from "@/lib/auth/route-access"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import type { Order } from "@/hooks/use-orders"
import type { DiningTable } from "@/hooks/use-dining-tables"
import type { PaginatedResponse } from "@/lib/api/types"

/**
 * Mounted once at the dashboard root. From the dashboard, the most likely
 * next stops are orders and dining tables (notifications are already loaded
 * eagerly by NotificationBell in the header) — so warm those two caches
 * once the active outlet is known, via a one-shot `prefetchQuery` rather
 * than the real page hooks, which would stay subscribed/refetching.
 */
export function DashboardBackgroundPrefetch() {
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const { outletId, isLoadingOutlets } = useActiveOutlet()

  const canViewOrders = hasRoutePermission(user, "orders.view")
  const canViewTables = hasRoutePermission(user, "dining-tables.view")

  useEffect(() => {
    // Wait for the real outlet instead of firing once with outletId
    // undefined (an unscoped all-outlets fetch) and again once it resolves.
    if (isLoadingOutlets || !outletId) return

    if (canViewOrders) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.orders.list({ outletId, limit: 20 }),
        queryFn: () => apiClient<PaginatedResponse<Order>>(`/orders?outletId=${outletId}&limit=20`),
      })
    }

    if (canViewTables) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.diningTables.list({ outletId, limit: 50 }),
        queryFn: () => apiClient<PaginatedResponse<DiningTable>>(`/dining-tables?outletId=${outletId}&limit=50`),
      })
    }
  }, [queryClient, canViewOrders, canViewTables, outletId, isLoadingOutlets])

  return null
}

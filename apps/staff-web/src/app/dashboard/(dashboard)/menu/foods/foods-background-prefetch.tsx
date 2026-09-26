"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/api/client"
import { queryKeys } from "@/lib/query-keys"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { hasRoutePermission } from "@/lib/auth/route-access"
import type { FoodVariant } from "@/hooks/use-food-variants"
import type { AddonGroup } from "@/hooks/use-addon-groups"
import type { Unit } from "@/hooks/use-units"
import type { PaginatedResponse } from "@/lib/api/types"

/**
 * Mounted only on the Foods page itself (not shell-wide) — from here, the
 * likely next stops are Food Variants, Addon Groups, and Units. One-shot
 * `prefetchQuery`s with the same `{limit:100}` params those pages' own
 * hooks use by default, so landing on them is a cache hit.
 *
 * Food Categories is deliberately not prefetched here: the Foods page
 * already fetches `useFoodCategories({ limit: 100 })` directly for its own
 * filter dropdown, which is the exact same query the Food Categories page
 * uses — that's already a cache hit with no extra request needed.
 */
export function FoodsBackgroundPrefetch() {
  const queryClient = useQueryClient()
  const user = useCurrentUser()

  const canViewVariants = hasRoutePermission(user, "food-variants.view")
  const canViewAddonGroups = hasRoutePermission(user, "addon-groups.view")
  const canViewUnits = hasRoutePermission(user, "units.view")

  useEffect(() => {
    if (canViewVariants) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.foodVariants.list({ limit: 100 }),
        queryFn: () => apiClient<PaginatedResponse<FoodVariant>>(`/food-variants?limit=100`),
      })
    }

    if (canViewAddonGroups) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.addonGroups.list({ limit: 100 }),
        queryFn: () => apiClient<PaginatedResponse<AddonGroup>>(`/addon-groups?limit=100`),
      })
    }

    if (canViewUnits) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.units.list({ limit: 100 }),
        queryFn: () => apiClient<PaginatedResponse<Unit>>(`/units?limit=100`),
      })
    }
  }, [queryClient, canViewVariants, canViewAddonGroups, canViewUnits])

  return null
}

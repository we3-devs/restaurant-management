import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"

export interface Permission {
  id: number
  name: string
  slug: string
  module: string
  action: string
  level: string
  isSystem: boolean
  isActive: boolean
  description: string | null
}

export function usePermissions() {
  return useQuery({
    queryKey: queryKeys.permissions.list(),
    queryFn: () => apiClient<Permission[]>("/permissions"),
    staleTime: STALE_TIME.reference,
  })
}

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { queryKeys } from "@/lib/query-keys"

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
  })
}

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"

export interface CurrentUser {
  id: number
  name: string
  email: string
  isSuperadmin: boolean
  permissions: string[]
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiClient<CurrentUser>("/auth/me"),
  })
}

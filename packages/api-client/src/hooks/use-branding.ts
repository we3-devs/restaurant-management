import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import { EMPTY_BRANDING, type Branding } from "../branding"

export function useBranding(): Branding {
  const query = useQuery({
    queryKey: ["branding"],
    queryFn: () => apiClient<Branding>("/settings/branding/public"),
    staleTime: 30 * 1000,
  })

  return query.data ?? EMPTY_BRANDING
}

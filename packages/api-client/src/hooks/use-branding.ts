import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import { EMPTY_BRANDING, type Branding } from "../branding"

export function useBranding(): Branding {
  // The tenant comes from the host (each tenant has its own staff subdomain),
  // so one cache entry per page load is enough.
  const query = useQuery({
    queryKey: ["branding"],
    queryFn: () => apiClient<Branding>("/settings/branding/public"),
    staleTime: 30 * 1000,
  })

  return query.data ?? EMPTY_BRANDING
}

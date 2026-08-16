import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import { EMPTY_BRANDING, type Branding } from "../branding"

/**
 * Client-side branding for app chrome (sidebar logo and name).
 *
 * Goes through the same-origin /api/backend proxy like every other staff-app
 * request. The endpoint itself is public, so this still resolves on the login
 * screen where there's no session yet.
 */
export function useBranding() {
  const query = useQuery({
    queryKey: ["branding"],
    queryFn: () => apiClient<Branding>("/settings/branding/public"),
    staleTime: 5 * 60 * 1000,
  })

  return query.data ?? EMPTY_BRANDING
}

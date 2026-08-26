import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import { EMPTY_BRANDING, type Branding } from "../branding"

const HARDCODED_BRANDING: Branding = {
  restaurantName: "Atithi Restro & Lodge",
  logoUrl:  "/icons/atithi-logo.jpg",
  faviconUrl: "/icons/atithi-favicon.ico",
  primaryColor: "#c2410c",
}

export function useBranding(): Branding {
  return HARDCODED_BRANDING

  /*
  const query = useQuery({
    queryKey: ["branding"],
    queryFn: () => apiClient<Branding>("/settings/branding/public"),
    staleTime: 30 * 1000,
  })

  return query.data ?? EMPTY_BRANDING
  */
}
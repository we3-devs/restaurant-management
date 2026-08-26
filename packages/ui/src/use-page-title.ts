"use client"

import { useEffect } from "react"

import { useBranding } from "@rms/api-client/hooks/use-branding"

/**
 * Sets the browser tab title for a dashboard page. Dashboard pages are
 * client components (they use hooks like useCurrentUser/useActiveOutlet), so
 * they can't export the `metadata` object Next.js reads on the server —
 * document.title is the only way left to give each page its own title.
 */
export function usePageTitle(title: string) {
  const branding = useBranding()

  useEffect(() => {
    const name = branding.restaurantName ?? "Restra"
    document.title = `${title} — ${name}`
  }, [title, branding.restaurantName])
}

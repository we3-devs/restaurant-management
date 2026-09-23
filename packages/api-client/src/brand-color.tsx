"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { applyBrandColor } from "./apply-brand-color"
import { useBranding } from "./hooks/use-branding"

/**
 * Renders nothing; exists to push the configured brand colour onto the theme
 * variables. Mounted in the root layout rather than inside the app shell so it
 * also covers the login and error screens, which render outside it.
 */
export function BrandColor() {
  const { primaryColor } = useBranding()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    applyBrandColor(primaryColor, resolvedTheme === "dark")
  }, [primaryColor, resolvedTheme])

  return null
}

/** Applies server-provided branding without requiring a QueryClientProvider. */
export function StaticBrandColor({ primaryColor }: { primaryColor: string | null | undefined }) {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    applyBrandColor(primaryColor, resolvedTheme === "dark")
  }, [primaryColor, resolvedTheme])

  return null
}

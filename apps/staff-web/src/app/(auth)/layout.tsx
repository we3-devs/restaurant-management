import { UtensilsCrossed } from "lucide-react"

import { fetchBranding } from "@rms/api-client/branding"
import { StaticBrandColor } from "@rms/api-client/brand-color"

import { BrandLogo } from "@/components/brand-logo"
import { BACKEND_API_BASE } from "@/lib/server/backend-client"
import { brandingHeaders, currentTenantName } from "@/lib/tenant"

/**
 * Server-resolved branding for the auth screens. Kept out of the root layout
 * so only unauthenticated pages pay for the round trip, and so the app can
 * render even if the backend is unreachable (EMPTY_BRANDING fallback).
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await fetchBranding(BACKEND_API_BASE, await brandingHeaders())
  const restaurantName = branding.restaurantName ?? (await currentTenantName())

  return (
    <div className="min-h-svh bg-muted/30">
      <StaticBrandColor primaryColor={branding.primaryColor} />

      <main className="relative flex min-h-svh w-full items-center justify-center bg-background p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center p-6">
          <BrandLogo logoUrl={branding.logoUrl} name={restaurantName} className="size-14 text-foreground" />
          <p className="font-semibold tracking-tight">{restaurantName}</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <UtensilsCrossed className="mx-auto size-8 text-primary" aria-hidden />
            <h2 className="font-heading mt-3 text-xl font-semibold tracking-tight">
              Staff sign in
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your credentials to continue.
            </p>
          </div>
          {children}
        </div>

        <p className="absolute inset-x-0 bottom-0 pb-6 text-center text-xs text-muted-foreground">
          {restaurantName} &middot; Restra Services &middot; &copy; {new Date().getFullYear()}
        </p>
      </main>
    </div>
  )
}

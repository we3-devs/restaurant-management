import { cache } from "react"

export interface Branding {
  restaurantName: string | null
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string | null
  qrTemplateUrl: string | null
  qrTemplateQrX: number | null
  qrTemplateQrY: number | null
  qrTemplateQrSize: number | null
  qrTemplateTableWidth: number | null
  qrTemplateTableFontSize: number | null
  qrTemplateTableTextColor: string | null
  qrTemplateTableX: number | null
  qrTemplateTableY: number | null
}

export const EMPTY_BRANDING: Branding = {
  restaurantName: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  qrTemplateUrl: null,
  qrTemplateQrX: null,
  qrTemplateQrY: null,
  qrTemplateQrSize: null,
  qrTemplateTableWidth: null,
  qrTemplateTableFontSize: null,
  qrTemplateTableTextColor: null,
  qrTemplateTableX: null,
  qrTemplateTableY: null,
}

/**
 * Server-side branding read for generateMetadata. Deliberately never throws:
 * the backend being down must degrade to the built-in name and icon, not take
 * out every page render in the app.
 *
 * `baseUrl` includes the /api prefix, e.g. http://localhost:3001/api.
 */
export const fetchBranding = cache(async (baseUrl: string, headers?: HeadersInit): Promise<Branding> => {
  try {
    // Next's fetch Data Cache keys on the URL (and body), not on headers — so
    // without this, every tenant's request collapses onto one shared cache
    // entry keyed by this same URL, and whichever tenant's response landed
    // there first gets served to everyone else until it expires. The tenant
    // slug is already sent unauthenticated via X-Tenant-Slug, so putting it
    // in the URL too leaks nothing new; it just gives each tenant its own
    // cache entry. The backend ignores this query param and still resolves
    // the tenant from the header.
    const tenantSlug = new Headers(headers).get("x-tenant-slug")
    const url = new URL(`${baseUrl}/settings/branding/public`)
    if (tenantSlug) url.searchParams.set("tenant", tenantSlug)

    const response = await fetch(url, {
      headers,
      // Short on purpose. Branding changes rarely, but when it does the admin
      // is staring at the settings screen waiting for it — a long TTL reads as
      // "the save didn't work". Browsers cache favicons independently and far
      // more aggressively, so that one can still need a hard reload.
      next: { revalidate: 30 },
    })
    if (!response.ok) return EMPTY_BRANDING
    return { ...EMPTY_BRANDING, ...((await response.json()) as Partial<Branding>) }
  } catch {
    return EMPTY_BRANDING
  }
})

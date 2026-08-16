export interface Branding {
  restaurantName: string | null
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string | null
}

export const EMPTY_BRANDING: Branding = {
  restaurantName: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
}

/**
 * Server-side branding read for generateMetadata. Deliberately never throws:
 * the backend being down must degrade to the built-in name and icon, not take
 * out every page render in the app.
 *
 * `baseUrl` includes the /api prefix, e.g. http://localhost:3001/api.
 */
export async function fetchBranding(baseUrl: string): Promise<Branding> {
  try {
    const response = await fetch(`${baseUrl}/settings/branding/public`, {
      // Branding changes rarely and is read on every render — cache it, but
      // not so long that an admin thinks their save didn't apply.
      next: { revalidate: 300 },
    })
    if (!response.ok) return EMPTY_BRANDING
    return { ...EMPTY_BRANDING, ...((await response.json()) as Partial<Branding>) }
  } catch {
    return EMPTY_BRANDING
  }
}

import type { NextRequest } from "next/server"

export type TenantSurface = "guest" | "staff"

export interface TenantContext {
  slug: string
  surface: TenantSurface
  host: string
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

function configuredRootDomains(): string[] {
  const configured = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN ?? process.env.TENANT_ROOT_DOMAIN
  // Keep both branded production domains recognized during the domain
  // migration. An explicit environment value still takes precedence and is
  // the recommended deployment configuration.
  return [...new Set([configured, "restraservices.com", "restra.com"])]
    .filter((domain): domain is string => Boolean(domain))
    .map((domain) => domain.toLowerCase().replace(/^\.+|\.+$/g, ""))
}

function cleanHost(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().split(":", 1)[0].replace(/\.$/, "")
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")
}

/** Superadmin is global and uses one dedicated host, without tenant context. */
export function isAllowedSuperadminHost(rawHost: string | null | undefined): boolean {
  const host = cleanHost(rawHost)
  if (process.env.NODE_ENV !== "production" && isLocalHost(host)) return true
  const configuredHost = cleanHost(
    process.env.NEXT_PUBLIC_SUPERADMIN_HOST ?? "pikachu.restraservices.com",
  )
  return host === configuredHost
}

/** Resolves only the production tenant host shapes; localhost remains host-only. */
export function resolveTenantHost(rawHost: string | null | undefined): TenantContext | null {
  const host = cleanHost(rawHost)
  if (!host || host === "localhost" || host === "127.0.0.1") return null

  for (const root of configuredRootDomains()) {
    const suffix = `.${root}`
    if (!host.endsWith(suffix)) continue

    const labels = host.slice(0, -suffix.length).split(".").filter(Boolean)
    if (labels.length === 1 && SLUG_RE.test(labels[0])) {
      return { slug: labels[0], surface: "guest", host }
    }
    if (labels.length === 2 && (labels[0] === "staff" || labels[0] === "guest") && SLUG_RE.test(labels[1])) {
      if (labels[0] === "guest") return { slug: labels[1], surface: "guest", host }
      return { slug: labels[1], surface: "staff", host }
    }
  }
  return null
}

/**
 * Whether this app may serve the request. In production an unknown host must
 * fail closed; otherwise a request sent to a Vercel preview/default domain can
 * bypass tenant resolution and reach unscoped application code.
 *
 * ALLOW_NON_TENANT_HOSTS is intentionally an explicit escape hatch for
 * preview deployments and local smoke tests. It must not be enabled on the
 * two production custom-domain projects.
 */
export function isAllowedTenantHost(
  rawHost: string | null | undefined,
  expectedSurface: TenantSurface,
): boolean {
  const host = cleanHost(rawHost)
  if (process.env.ALLOW_NON_TENANT_HOSTS === "true") return true
  if (process.env.NODE_ENV !== "production" && isLocalHost(host)) return true
  return resolveTenantHost(host)?.surface === expectedSurface
}

export function tenantHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  const tenant = resolveTenantHost(request.headers.get("host"))
  if (tenant) {
    // Always overwrite these values. A browser/client must never be able to
    // choose a different tenant by sending its own x-tenant-* headers.
    headers.set("x-tenant-slug", tenant.slug)
    headers.set("x-tenant-surface", tenant.surface)
  } else {
    headers.delete("x-tenant-slug")
    headers.delete("x-tenant-surface")
  }
  return headers
}

export function tenantFromRequest(request: Request): TenantContext | null {
  const slug = request.headers.get("x-tenant-slug")
  const surface = request.headers.get("x-tenant-surface")
  const host = cleanHost(request.headers.get("host"))
  if (!slug || !SLUG_RE.test(slug) || (surface !== "guest" && surface !== "staff")) return null
  return { slug, surface, host }
}

/** Builds the public guest QR URL for a tenant-owned table. */
export function tenantGuestUrl(tenantSlug: string | null | undefined, tableCode: string): string | null {
  if (!tenantSlug || !tableCode) return null
  const root = configuredRootDomains()[0] ?? 'restraservices.com'
  const protocol = root.endsWith('.localhost') ? 'http' : 'https'
  return `${protocol}://guest.${tenantSlug}.${root}/?table=${encodeURIComponent(tableCode)}`
}

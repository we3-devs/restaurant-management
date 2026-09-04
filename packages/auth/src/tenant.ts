import type { NextRequest } from "next/server"

export type TenantSurface = "guest" | "staff"

export interface TenantContext {
  slug: string
  surface: TenantSurface
  host: string
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

function configuredRootDomain(): string {
  return (process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN ?? process.env.TENANT_ROOT_DOMAIN ?? "restra.com")
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "")
}

function cleanHost(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().split(":", 1)[0].replace(/\.$/, "")
}

/** Resolves only the production tenant host shapes; localhost remains host-only. */
export function resolveTenantHost(rawHost: string | null | undefined): TenantContext | null {
  const host = cleanHost(rawHost)
  const root = configuredRootDomain()
  if (!host || !root || host === "localhost" || host === "127.0.0.1") return null

  const suffix = `.${root}`
  if (!host.endsWith(suffix)) return null

  const labels = host.slice(0, -suffix.length).split(".").filter(Boolean)
  if (labels.length === 1 && SLUG_RE.test(labels[0])) {
    return { slug: labels[0], surface: "guest", host }
  }
  if (labels.length === 2 && labels[0] === "staff" && SLUG_RE.test(labels[1])) {
    return { slug: labels[1], surface: "staff", host }
  }
  return null
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

import { headers } from "next/headers"

import { resolveTenantHost } from "@rms/auth/tenant"

/** "momo-palace" → "Momo Palace"; falls back to the built-in name off-tenant. */
export function tenantDisplayName(slug: string | undefined): string {
  if (!slug) return "Restra"
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/** X-Tenant-Slug header for backend reads (branding, etc.) on the current host. */
export async function brandingHeaders(): Promise<HeadersInit | undefined> {
  const tenant = resolveTenantHost((await headers()).get("host"))
  return tenant ? { "X-Tenant-Slug": tenant.slug } : undefined
}

/** Display name of the tenant serving the current request (metadata, titles). */
export async function currentTenantName(): Promise<string> {
  const tenant = resolveTenantHost((await headers()).get("host"))
  return tenantDisplayName(tenant?.slug)
}

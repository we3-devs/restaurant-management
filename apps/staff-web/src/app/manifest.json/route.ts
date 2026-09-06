import type { MetadataRoute } from "next";
import { resolveTenantHost } from "@rms/auth/tenant";
import { NextResponse } from "next/server";
import { fetchBranding } from "@rms/api-client/branding";
import { BACKEND_API_BASE } from "@/lib/server/backend-client";

export const revalidate = 30;

export async function GET(request: Request) {
  const tenant = resolveTenantHost(request.headers.get("host"));
  const branding = await fetchBranding(
    BACKEND_API_BASE,
    tenant ? { "X-Tenant-Slug": tenant.slug } : undefined,
  );
  const restaurantName = branding.restaurantName?.trim() || "Restra";
  const appName = `${restaurantName} Staff`;
  const icon = branding.logoUrl ?? branding.faviconUrl ?? "/icons/favicon.ico";

  const manifest: MetadataRoute.Manifest = {
    name: appName,
    short_name: appName,
    description: `${appName} restaurant operations app`,
    start_url: "/operational/staff/tables",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: branding.primaryColor ?? "#0430de",
    icons: [
      { src: icon, sizes: "any", purpose: "any" },
      { src: icon, sizes: "any", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
  });
}

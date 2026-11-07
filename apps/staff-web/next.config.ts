import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local dev is accessed through tenant subdomains (staff.<slug>.localhost,
  // per NEXT_PUBLIC_TENANT_ROOT_DOMAIN) rather than bare localhost. Next's
  // dev server rejects cross-origin requests it doesn't recognize —
  // including the HMR WebSocket upgrade — from any origin not listed here.
  // That silent rejection aborts hydrate()'s bootstrap (it sets up the HMR
  // socket inline), leaving the page fully rendered but non-interactive:
  // forms fall back to native submission instead of calling their onSubmit.
  // "*.localhost" only matches one subdomain level (e.g. test.localhost),
  // not the two-level "staff.<slug>.localhost" shape this app is actually
  // accessed at — so it must be listed explicitly alongside the wildcard.
  allowedDevOrigins: [
    "*.localhost",
    "*.*.localhost",
    "*.*.restra.localhost",
  ],
};

export default nextConfig;

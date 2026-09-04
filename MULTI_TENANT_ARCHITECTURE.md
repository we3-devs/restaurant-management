# Restra multi-tenant web architecture

## Host contract

- Guest: `{tenant}.restra.com` → `guest-web`
- Staff: `staff.{tenant}.restra.com` → the staff deployment serving dashboard and operational routes
- The Next proxy derives `x-tenant-slug` and `x-tenant-surface` from `Host`. Client-supplied tenant headers are overwritten.
- Production requests with an unknown host, or a host on the wrong app surface, return `421 Misdirected Request`.

The backend must treat the forwarded tenant as request context and scope every read/write by the resolved outlet/client. The current `TenantGuard` verifies staff access to the outlet, but public menu services still need to accept that resolved outlet and add it to their queries before this requirement is complete.

## DNS and Vercel limitation

`*.restra.com` covers one-label hosts such as `demo.restra.com`; it does **not** cover `staff.demo.restra.com`. Vercel documents wildcard domains, but wildcard certificates/domains use the nameservers method and Vercel does not support a universal multi-level wildcard.

The exact two-hostname design therefore requires one of these arrangements:

1. provision/map `staff.{tenant}.restra.com` per tenant (and issue certificates for each hostname),
2. use a DNS/edge layer that supports the required host routing and certificates, or
3. flatten the staff hostname (for example `staff-{tenant}.restra.com`) or use a staff path on `{tenant}.restra.com`.

Do not assume that adding only `*.restra.com` makes the nested staff host reachable.

For local development, set `NEXT_PUBLIC_TENANT_ROOT_DOMAIN=restra.localhost` and use `demo.restra.localhost` and `staff.demo.restra.localhost`. Set `ALLOW_NON_TENANT_HOSTS=true` only for preview/smoke deployments that intentionally use a non-tenant Vercel hostname.

## Cookies

Staff access and refresh cookies remain host-only by default. This is safest for the split guest/staff origins. If dashboard and operational are separate deployments but share `staff.{tenant}.restra.com`, both paths naturally share the host-only cookie. Do not set `AUTH_COOKIE_DOMAIN=.restra.com`, because that would make staff cookies available to guest origins.

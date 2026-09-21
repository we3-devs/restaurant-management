import { NextRequest, NextResponse } from "next/server"
import { resolveTenantHost } from "@rms/auth/tenant"
import { customerBackendFetch, CustomerUnauthorizedError } from "@rms/auth/server/customer-backend-client"

// This proxy fronts every guest API call (menu, orders, order tracking), so
// its own region matters as much as the backend's does. Left unset, Vercel
// picked Washington D.C. for a request that originated in Mumbai and was
// headed to a backend that's nowhere near either — three long-haul hops
// stacked on top of whatever the backend itself takes, on every request.
// bom1 puts this function next to where guests actually are; if the
// backend later moves to a different region, this should move with it.
export const preferredRegion = ["bom1"]

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>) {
  const tenant = resolveTenantHost(request.headers.get("host"))
  if (!tenant || tenant.surface !== "guest") {
    return new NextResponse("Unknown tenant host", { status: 421, headers: { "Cache-Control": "no-store" } })
  }

  const { path } = await params
  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const body = hasBody ? await request.text() : undefined
  const authorization = request.headers.get("authorization")
  const tokenOverride = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : undefined

  try {
    const response = await customerBackendFetch(`/${path.join("/")}${request.nextUrl.search}`, {
      method: request.method,
      body: body || undefined,
      headers: { "X-Tenant-Slug": tenant.slug },
    }, tokenOverride)
    const responseBody = response.status === 204 ? null : await response.arrayBuffer()
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    })
  } catch (error) {
    if (error instanceof CustomerUnauthorizedError) return NextResponse.json({ message: "Session expired" }, { status: 401 })
    throw error
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxy(request, context.params) }
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxy(request, context.params) }
export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxy(request, context.params) }
export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return proxy(request, context.params) }

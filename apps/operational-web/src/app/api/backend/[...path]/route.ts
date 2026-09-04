import { NextRequest, NextResponse } from "next/server"
import { BackendUnauthorizedError, backendFetch } from "@rms/auth/server/backend-client"
import { tenantFromRequest } from "@rms/auth/tenant"

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>): Promise<NextResponse> {
  const { path } = await params
  const search = request.nextUrl.search
  const targetPath = `/${path.join("/")}${search}`

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const body = hasBody ? await request.text() : undefined

  try {
    const tenant = tenantFromRequest(request)
    const response = await backendFetch(targetPath, {
      method: request.method,
      body: body || undefined,
      headers: {
        ...(request.headers.get("X-Outlet-Closed-Override")
          ? { "X-Outlet-Closed-Override": request.headers.get("X-Outlet-Closed-Override")! }
          : {}),
        ...(tenant ? { "X-Tenant-Slug": tenant.slug } : {}),
      },
    })

    // arrayBuffer (not text()) so binary bodies — report exports (xlsx/pdf)
    // — survive the round trip intact; works fine for JSON/text bodies too.
    const responseBody = response.status === 204 ? null : await response.arrayBuffer()
    const headers = new Headers({
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    })
    const disposition = response.headers.get("Content-Disposition")
    if (disposition) headers.set("Content-Disposition", disposition)

    return new NextResponse(responseBody, { status: response.status, headers })
  } catch (error) {
    if (error instanceof BackendUnauthorizedError) {
      return NextResponse.json({ message: "Session expired" }, { status: 401 })
    }
    throw error
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

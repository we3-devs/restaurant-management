import { NextRequest, NextResponse } from "next/server"
import { customerBackendFetch, CustomerUnauthorizedError } from "@rms/auth/server/customer-backend-client"

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>): Promise<NextResponse> {
  const { path } = await params
  const search = request.nextUrl.search
  const targetPath = `/${path.join("/")}${search}`

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const body = hasBody ? await request.text() : undefined

  // If the client sent its own token (from the localStorage backstop — see
  // customer-client.ts), prefer that over the httpOnly cookie: it's the
  // whole point of the backstop that this still works when the cookie
  // didn't make it to the browser in the first place.
  const authHeader = request.headers.get("authorization")
  const tokenOverride = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : undefined

  try {
    const response = await customerBackendFetch(
      targetPath,
      {
        method: request.method,
        body: body || undefined,
        headers: {},
      },
      tokenOverride,
    )

    const responseBody = response.status === 204 ? null : await response.arrayBuffer()
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    })
  } catch (error) {
    if (error instanceof CustomerUnauthorizedError) {
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

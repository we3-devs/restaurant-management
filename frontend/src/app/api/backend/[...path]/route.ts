import { NextRequest, NextResponse } from "next/server"
import { BackendUnauthorizedError, backendFetch } from "@/lib/server/backend-client"

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>): Promise<NextResponse> {
  const { path } = await params
  const search = request.nextUrl.search
  const targetPath = `/${path.join("/")}${search}`

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const body = hasBody ? await request.text() : undefined

  try {
    const response = await backendFetch(targetPath, {
      method: request.method,
      body: body || undefined,
    })

    const responseBody = response.status === 204 ? null : await response.text()
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    })
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

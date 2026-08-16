import { NextRequest, NextResponse } from "next/server"
import { BackendUnauthorizedError, backendFetch } from "@/lib/server/backend-client"

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>): Promise<NextResponse> {
  const { path } = await params
  const search = request.nextUrl.search
  const targetPath = `/${path.join("/")}${search}`

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const contentType = request.headers.get("Content-Type") ?? ""
  // multipart/form-data carries a generated boundary in its Content-Type and
  // raw bytes in its body. text() would decode those bytes as UTF-8 and
  // corrupt them, and dropping the header would lose the boundary — so binary
  // content types are forwarded as an untouched ArrayBuffer with their header
  // intact. ArrayBuffer (not a stream) also stays replayable for
  // backendFetch's refresh-and-retry on 401.
  const isBinary = hasBody && contentType !== "" && !contentType.includes("application/json")

  let body: string | ArrayBuffer | undefined
  if (hasBody) {
    if (isBinary) {
      const buffer = await request.arrayBuffer()
      body = buffer.byteLength ? buffer : undefined
    } else {
      body = (await request.text()) || undefined
    }
  }

  try {
    const response = await backendFetch(targetPath, {
      method: request.method,
      body,
      headers: isBinary ? { "Content-Type": contentType } : undefined,
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

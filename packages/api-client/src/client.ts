/** Same as Error, plus the HTTP status — lets callers (e.g. the offline mutation queue) distinguish a 400 from a 404/500 without reparsing the message. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/**
 * Browser-side fetch wrapper. Always hits the same-origin proxy at
 * /api/backend/*, never the NestJS origin directly — the proxy attaches the
 * token server-side, so no token or CORS handling is needed here.
 */
export async function apiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(body?.message ?? `Request to ${path} failed with ${response.status}`, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

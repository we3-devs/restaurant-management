/** Browser-side fetch wrapper for the customer portal / guest-ordering proxy (mirrors client.ts's apiClient, different base path — attaches the customer JWT server-side, see api/customer-backend/[...path]/route.ts). */
export async function customerApiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/customer-backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? `Request to ${path} failed with ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export function toQueryString(params: object = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

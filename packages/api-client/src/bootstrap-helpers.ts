import type { PaginatedResponse } from "./types"

/** Wraps an already-fetched array as a PaginatedResponse so it can seed the
 * query cache for hooks that expect the list shape (single page, no more). */
export function asPaginated<T>(data: T[]): PaginatedResponse<T> {
  return { data, meta: { page: 1, limit: data.length || 1, total: data.length, totalPages: 1 } }
}

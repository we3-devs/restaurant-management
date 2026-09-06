import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type { CreateDiningTableInput, UpdateDiningTableInput } from "@rms/validators/dining-tables"

export interface DiningTable {
  id: number
  outletId: number
  diningAreaId: number
  name: string
  code: string | null
  capacity: number
  status: string
  positionX: number
  positionY: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ListDiningTablesParams {
  page?: number
  limit?: number
  search?: string
  outletId?: number
  diningAreaId?: number
  status?: string
}

export function useDiningTables(params: ListDiningTablesParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.diningTables.list(params),
    queryFn: () => apiClient<PaginatedResponse<DiningTable>>(`/dining-tables${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.tables,
    enabled: options?.enabled,
  })
}

export function useDiningTable(id: number) {
  return useQuery({
    queryKey: queryKeys.diningTables.detail(id),
    queryFn: () => apiClient<DiningTable>(`/dining-tables/${id}`),
    enabled: id > 0,
  })
}

export function useCreateDiningTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDiningTableInput) =>
      apiClient<DiningTable>("/dining-tables", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() }),
  })
}

export function useUpdateDiningTable(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateDiningTableInput) =>
      apiClient<DiningTable>(`/dining-tables/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.detail(id) })
    },
  })
}

export function useDeleteDiningTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/dining-tables/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() }),
  })
}

/**
 * Flips a dining table's status everywhere it's cached — the detail query
 * plus every list query that currently holds that row (found by id, not by
 * re-deriving which area/outlet filters it belongs to, since callers rarely
 * have the full DiningTable to hand). A list filtered to a status the table
 * no longer matches (e.g. a `status: "available"` list once it's occupied)
 * has the row removed rather than just relabeled, so it doesn't linger there
 * stale.
 *
 * This is what makes occupancy changes feel instant: the floor board renders
 * straight off `table.status` (see floor/table-card.tsx), and an
 * invalidation alone can't help it — the board is unmounted while staff are
 * on the POS/checkout screen, so the confirming GET only lands once they
 * navigate back to it.
 */
export function patchDiningTableStatus(
  queryClient: QueryClient,
  diningTableId: number,
  status: DiningTable["status"],
): void {
  queryClient.setQueryData<DiningTable>(queryKeys.diningTables.detail(diningTableId), (old) =>
    old ? { ...old, status } : old,
  )

  const entries = queryClient.getQueriesData<PaginatedResponse<DiningTable>>({
    queryKey: queryKeys.diningTables.lists(),
  })
  for (const [key, data] of entries) {
    if (!data) continue
    const index = data.data.findIndex((table) => table.id === diningTableId)
    if (index === -1) continue

    const params = (key[2] as ListDiningTablesParams | undefined) ?? {}
    if (params.status !== undefined && params.status !== status) {
      const total = Math.max(data.meta.total - 1, 0)
      queryClient.setQueryData(key, {
        data: data.data.filter((table) => table.id !== diningTableId),
        meta: { ...data.meta, total, totalPages: Math.ceil(total / data.meta.limit) || 1 },
      })
      continue
    }

    const nextRows = [...data.data]
    nextRows[index] = { ...nextRows[index], status }
    queryClient.setQueryData(key, { ...data, data: nextRows })
  }
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type { CreateDiningTableInput, UpdateDiningTableInput } from "@/lib/validators/dining-tables"

export interface DiningTable {
  id: number
  outletId: number
  diningAreaId: number
  name: string
  code: string | null
  capacity: number
  status: string
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

export function useDiningTables(params: ListDiningTablesParams = {}) {
  return useQuery({
    queryKey: queryKeys.diningTables.list(params),
    queryFn: () => apiClient<PaginatedResponse<DiningTable>>(`/dining-tables${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.tables,
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

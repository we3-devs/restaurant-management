import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type { CreateWarehouseInput, UpdateWarehouseInput } from "@rms/validators/warehouses"

export interface Warehouse {
  id: number
  outletId: number
  outletDepartmentId: number | null
  name: string
  code: string
  address: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ListWarehousesParams {
  page?: number
  limit?: number
  search?: string
  outletId?: number
}

export function useWarehouses(params: ListWarehousesParams = {}) {
  return useQuery({
    queryKey: queryKeys.warehouses.list(params),
    queryFn: () => apiClient<PaginatedResponse<Warehouse>>(`/warehouses${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.reference,
  })
}

export function useWarehouse(id: number) {
  return useQuery({
    queryKey: queryKeys.warehouses.detail(id),
    queryFn: () => apiClient<Warehouse>(`/warehouses/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWarehouseInput) =>
      apiClient<Warehouse>("/warehouses", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.lists() }),
  })
}

export function useUpdateWarehouse(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateWarehouseInput) =>
      apiClient<Warehouse>(`/warehouses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.detail(id) })
    },
  })
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.lists() }),
  })
}

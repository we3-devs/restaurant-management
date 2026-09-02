import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type { CreateDiningAreaInput, UpdateDiningAreaInput } from "@rms/validators/dining-areas"

export interface DiningArea {
  id: number
  outletId: number
  name: string
  code: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ListDiningAreasParams {
  page?: number
  limit?: number
  search?: string
  outletId?: number
}

export function useDiningAreas(params: ListDiningAreasParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.diningAreas.list(params),
    queryFn: () => apiClient<PaginatedResponse<DiningArea>>(`/dining-areas${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.reference,
    enabled: options.enabled ?? true,
  })
}

export function useDiningArea(id: number) {
  return useQuery({
    queryKey: queryKeys.diningAreas.detail(id),
    queryFn: () => apiClient<DiningArea>(`/dining-areas/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useCreateDiningArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDiningAreaInput) =>
      apiClient<DiningArea>("/dining-areas", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diningAreas.lists() }),
  })
}

export function useUpdateDiningArea(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateDiningAreaInput) =>
      apiClient<DiningArea>(`/dining-areas/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diningAreas.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningAreas.detail(id) })
    },
  })
}

export function useDeleteDiningArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/dining-areas/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diningAreas.lists() }),
  })
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateOutletInput, UpdateOutletInput } from "@/lib/validators/outlets"

export interface Outlet {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface ListOutletsParams {
  page?: number
  limit?: number
  search?: string
}

export function useOutlets(params: ListOutletsParams = {}) {
  return useQuery({
    queryKey: queryKeys.outlets.list(params),
    queryFn: () => apiClient<PaginatedResponse<Outlet>>(`/outlets${toQueryString(params)}`),
  })
}

export function useOutlet(id: number) {
  return useQuery({
    queryKey: queryKeys.outlets.detail(id),
    queryFn: () => apiClient<Outlet>(`/outlets/${id}`),
    enabled: id > 0,
  })
}

export function useCreateOutlet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOutletInput) => apiClient<Outlet>("/outlets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outlets.lists() }),
  })
}

export function useUpdateOutlet(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOutletInput) =>
      apiClient<Outlet>(`/outlets/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outlets.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.outlets.detail(id) })
    },
  })
}

export function useDeleteOutlet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/outlets/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outlets.lists() }),
  })
}

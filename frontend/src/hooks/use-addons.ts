import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateAddonInput, UpdateAddonInput } from "@/lib/validators/addons"

export interface Addon {
  id: number
  addonGroupId: number | null
  name: string
  price: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ListAddonsParams {
  page?: number
  limit?: number
  search?: string
  addonGroupId?: number
}

export function useAddons(params: ListAddonsParams = {}) {
  return useQuery({
    queryKey: queryKeys.addons.list(params),
    queryFn: () => apiClient<PaginatedResponse<Addon>>(`/addons${toQueryString(params)}`),
  })
}

export function useAddon(id: number) {
  return useQuery({
    queryKey: queryKeys.addons.detail(id),
    queryFn: () => apiClient<Addon>(`/addons/${id}`),
    enabled: id > 0,
  })
}

export function useCreateAddon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAddonInput) => apiClient<Addon>("/addons", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.addons.lists() }),
  })
}

export function useUpdateAddon(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateAddonInput) =>
      apiClient<Addon>(`/addons/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addons.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.addons.detail(id) })
    },
  })
}

export function useDeleteAddon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/addons/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.addons.lists() }),
  })
}

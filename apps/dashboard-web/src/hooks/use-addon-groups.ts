import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type { CreateAddonGroupInput, UpdateAddonGroupInput } from "@/lib/validators/addon-groups"

export interface AddonGroup {
  id: number
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ListAddonGroupsParams {
  page?: number
  limit?: number
  search?: string
}

export function useAddonGroups(params: ListAddonGroupsParams = {}) {
  return useQuery({
    queryKey: queryKeys.addonGroups.list(params),
    queryFn: () => apiClient<PaginatedResponse<AddonGroup>>(`/addon-groups${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.reference,
  })
}

export function useAddonGroup(id: number) {
  return useQuery({
    queryKey: queryKeys.addonGroups.detail(id),
    queryFn: () => apiClient<AddonGroup>(`/addon-groups/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useCreateAddonGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAddonGroupInput) =>
      apiClient<AddonGroup>("/addon-groups", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.addonGroups.lists() }),
  })
}

export function useUpdateAddonGroup(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateAddonGroupInput) =>
      apiClient<AddonGroup>(`/addon-groups/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addonGroups.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.addonGroups.detail(id) })
    },
  })
}

export function useDeleteAddonGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/addon-groups/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.addonGroups.lists() }),
  })
}

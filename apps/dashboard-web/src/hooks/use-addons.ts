import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type { CreateAddonRecipeInput } from "@/lib/validators/addon-recipes"
import type { CreateAddonInput, UpdateAddonInput } from "@/lib/validators/addons"

export interface Addon {
  id: number
  addonGroupId: number | null
  name: string
  price: number
  isRecipeEnabled: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface AddonRecipe {
  id: number
  addonId: number
  ingredientId: number
  unitId: number
  quantity: number
  wastageQuantity: number
  isActive: boolean
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
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.addons,
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

export function useAddonRecipes(addonId: number) {
  return useQuery({
    queryKey: queryKeys.addons.recipes(addonId),
    queryFn: () => apiClient<AddonRecipe[]>(`/addons/${addonId}/recipes`),
    enabled: addonId > 0,
  })
}

export function useAddAddonRecipe(addonId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAddonRecipeInput) =>
      apiClient<AddonRecipe>(`/addons/${addonId}/recipes`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.addons.recipes(addonId) }),
  })
}

export function useRemoveAddonRecipe(addonId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recipeId: number) =>
      apiClient<void>(`/addons/${addonId}/recipes/${recipeId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.addons.recipes(addonId) }),
  })
}

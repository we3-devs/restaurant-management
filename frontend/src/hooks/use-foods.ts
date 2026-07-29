import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateFoodInput, UpdateFoodInput, UpsertFoodOutletInput } from "@/lib/validators/foods"

export interface Food {
  id: number
  foodCategoryId: number | null
  name: string
  slug: string
  sku: string | null
  shortDescription: string | null
  description: string | null
  foodType: string | null
  itemType: string
  basePrice: number
  hasVariants: boolean
  hasAddons: boolean
  isTaxable: boolean
  isDiscountable: boolean
  isFeatured: boolean
  isActive: boolean
  preparationTime: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface FoodOutlet {
  id: number
  foodId: number
  outletId: number
  price: number | null
  isAvailable: boolean
  isActive: boolean
}

export interface FoodAddonGroupLink {
  id: number
  foodId: number
  addonGroupId: number
  addonGroup?: { id: number; name: string }
}

export interface ListFoodsParams {
  page?: number
  limit?: number
  search?: string
  foodCategoryId?: number
}

export function useFoods(params: ListFoodsParams = {}) {
  return useQuery({
    queryKey: queryKeys.foods.list(params),
    queryFn: () => apiClient<PaginatedResponse<Food>>(`/foods${toQueryString(params)}`),
  })
}

export function useFood(id: number) {
  return useQuery({
    queryKey: queryKeys.foods.detail(id),
    queryFn: () => apiClient<Food>(`/foods/${id}`),
    enabled: id > 0,
  })
}

export function useCreateFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFoodInput) => apiClient<Food>("/foods", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() }),
  })
}

export function useUpdateFood(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFoodInput) =>
      apiClient<Food>(`/foods/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.detail(id) })
    },
  })
}

export function useDeleteFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/foods/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() }),
  })
}

export function useFoodOutlets(foodId: number) {
  return useQuery({
    queryKey: queryKeys.foods.outlets(foodId),
    queryFn: () => apiClient<FoodOutlet[]>(`/foods/${foodId}/outlets`),
    enabled: foodId > 0,
  })
}

export function useUpsertFoodOutlet(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertFoodOutletInput) =>
      apiClient<FoodOutlet>(`/foods/${foodId}/outlets`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.outlets(foodId) }),
  })
}

export function useRemoveFoodOutlet(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (outletId: number) =>
      apiClient<void>(`/foods/${foodId}/outlets/${outletId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.outlets(foodId) }),
  })
}

export function useFoodAddonGroups(foodId: number) {
  return useQuery({
    queryKey: queryKeys.foods.addonGroups(foodId),
    queryFn: () => apiClient<FoodAddonGroupLink[]>(`/foods/${foodId}/addon-groups`),
    enabled: foodId > 0,
  })
}

export function useAssignFoodAddonGroup(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addonGroupId: number) =>
      apiClient<void>(`/foods/${foodId}/addon-groups`, { method: "POST", body: JSON.stringify({ addonGroupId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.addonGroups(foodId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.detail(foodId) })
    },
  })
}

export function useUnassignFoodAddonGroup(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addonGroupId: number) =>
      apiClient<void>(`/foods/${foodId}/addon-groups/${addonGroupId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.addonGroups(foodId) }),
  })
}

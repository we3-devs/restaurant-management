import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type {
  CreateFoodVariantInput,
  UpdateFoodVariantInput,
  UpsertFoodVariantOutletInput,
} from "@/lib/validators/food-variants"

export interface FoodVariant {
  id: number
  foodId: number
  name: string
  sku: string | null
  price: number
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface FoodVariantOutlet {
  id: number
  foodVariantId: number
  outletId: number
  price: number | null
  isAvailable: boolean
  isActive: boolean
}

export interface ListFoodVariantsParams {
  page?: number
  limit?: number
  search?: string
  foodId?: number
}

export function useFoodVariants(params: ListFoodVariantsParams = {}) {
  return useQuery({
    queryKey: queryKeys.foodVariants.list(params),
    queryFn: () => apiClient<PaginatedResponse<FoodVariant>>(`/food-variants${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.foodVariants,
  })
}

export function useFoodVariant(id: number) {
  return useQuery({
    queryKey: queryKeys.foodVariants.detail(id),
    queryFn: () => apiClient<FoodVariant>(`/food-variants/${id}`),
    enabled: id > 0,
  })
}

export function useCreateFoodVariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFoodVariantInput) =>
      apiClient<FoodVariant>("/food-variants", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.lists() }),
  })
}

export function useUpdateFoodVariant(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFoodVariantInput) =>
      apiClient<FoodVariant>(`/food-variants/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.detail(id) })
    },
  })
}

export function useDeleteFoodVariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/food-variants/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.lists() }),
  })
}

export function useFoodVariantOutlets(variantId: number) {
  return useQuery({
    queryKey: queryKeys.foodVariants.outlets(variantId),
    queryFn: () => apiClient<FoodVariantOutlet[]>(`/food-variants/${variantId}/outlets`),
    enabled: variantId > 0,
  })
}

export function useUpsertFoodVariantOutlet(variantId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertFoodVariantOutletInput) =>
      apiClient<FoodVariantOutlet>(`/food-variants/${variantId}/outlets`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.outlets(variantId) }),
  })
}

export function useRemoveFoodVariantOutlet(variantId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (outletId: number) =>
      apiClient<void>(`/food-variants/${variantId}/outlets/${outletId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.outlets(variantId) }),
  })
}

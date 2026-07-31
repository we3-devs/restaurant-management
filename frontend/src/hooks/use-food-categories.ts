import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type {
  CreateFoodCategoryInput,
  UpdateFoodCategoryInput,
} from "@/lib/validators/food-categories"

export interface FoodCategory {
  id: number
  parentId: number | null
  name: string
  slug: string
  description: string | null
  image: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ListFoodCategoriesParams {
  page?: number
  limit?: number
  search?: string
  parentId?: number
}

export function useFoodCategories(params: ListFoodCategoriesParams = {}) {
  return useQuery({
    queryKey: queryKeys.foodCategories.list(params),
    queryFn: () =>
      apiClient<PaginatedResponse<FoodCategory>>(`/food-categories${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.reference,
  })
}

export function useFoodCategory(id: number) {
  return useQuery({
    queryKey: queryKeys.foodCategories.detail(id),
    queryFn: () => apiClient<FoodCategory>(`/food-categories/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useCreateFoodCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFoodCategoryInput) =>
      apiClient<FoodCategory>("/food-categories", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foodCategories.lists() }),
  })
}

export function useUpdateFoodCategory(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFoodCategoryInput) =>
      apiClient<FoodCategory>(`/food-categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodCategories.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.foodCategories.detail(id) })
    },
  })
}

export function useDeleteFoodCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/food-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foodCategories.lists() }),
  })
}

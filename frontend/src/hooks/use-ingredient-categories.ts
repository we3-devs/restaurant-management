import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type {
  CreateIngredientCategoryInput,
  UpdateIngredientCategoryInput,
} from "@/lib/validators/ingredient-categories"

export interface IngredientCategory {
  id: number
  name: string
  slug: string
  code: string | null
  parentId: number | null
  isActive: boolean
}

export interface ListIngredientCategoriesParams {
  page?: number
  limit?: number
  search?: string
  parentId?: number
}

export function useIngredientCategories(params: ListIngredientCategoriesParams = {}) {
  return useQuery({
    queryKey: queryKeys.ingredientCategories.list(params),
    queryFn: () => apiClient<PaginatedResponse<IngredientCategory>>(`/ingredient-categories${toQueryString(params)}`),
  })
}

export function useIngredientCategory(id: number) {
  return useQuery({
    queryKey: queryKeys.ingredientCategories.detail(id),
    queryFn: () => apiClient<IngredientCategory>(`/ingredient-categories/${id}`),
    enabled: id > 0,
  })
}

export function useCreateIngredientCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIngredientCategoryInput) =>
      apiClient<IngredientCategory>("/ingredient-categories", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredientCategories.lists() }),
  })
}

export function useUpdateIngredientCategory(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateIngredientCategoryInput) =>
      apiClient<IngredientCategory>(`/ingredient-categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredientCategories.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredientCategories.detail(id) })
    },
  })
}

export function useDeleteIngredientCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/ingredient-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredientCategories.lists() }),
  })
}

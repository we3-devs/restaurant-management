import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type { CreateIngredientInput, UpdateIngredientInput } from "@/lib/validators/ingredients"

export interface Ingredient {
  id: number
  ingredientCategoryId: number | null
  name: string
  slug: string
  code: string
  type: "raw_material" | "ready_product" | "packaging" | "consumable"
  baseUnitId: number
  isActive: boolean
}

export interface ListIngredientsParams {
  page?: number
  limit?: number
  search?: string
  ingredientCategoryId?: number
  type?: string
}

export function useIngredients(params: ListIngredientsParams = {}) {
  return useQuery({
    queryKey: queryKeys.ingredients.list(params),
    queryFn: () => apiClient<PaginatedResponse<Ingredient>>(`/ingredients${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.ingredients,
  })
}

export function useIngredient(id: number) {
  return useQuery({
    queryKey: queryKeys.ingredients.detail(id),
    queryFn: () => apiClient<Ingredient>(`/ingredients/${id}`),
    enabled: id > 0,
  })
}

export function useCreateIngredient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIngredientInput) =>
      apiClient<Ingredient>("/ingredients", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.lists() }),
  })
}

export function useUpdateIngredient(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateIngredientInput) =>
      apiClient<Ingredient>(`/ingredients/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.detail(id) })
    },
  })
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/ingredients/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.lists() }),
  })
}

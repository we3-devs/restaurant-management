import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type { CreateIngredientInput, UpdateIngredientInput } from "@rms/validators/ingredients"

export interface Ingredient {
  id: number
  outletId: number
  ingredientCategoryId: number
  category: {
    id: number
    name: string
    type: "raw_material" | "ready_product" | "packaging" | "consumable" | "beverage"
  }
  name: string
  slug: string
  code: string
  image: string | null
  buyingPrice: number
  sellingPrice: number
  baseUnitId: number
  defaultPurchaseUnitId: number | null
  defaultUsageUnitId: number | null
  isActive: boolean
}

export interface ListIngredientsParams {
  page?: number
  limit?: number
  outletId?: number
  search?: string
  ingredientCategoryId?: number
  /** Filters by the ingredient's category's type. */
  type?: string
  /** Only return ingredients whose category's type supports stock tracking (beverage, packaging, consumable). */
  trackableOnly?: boolean
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

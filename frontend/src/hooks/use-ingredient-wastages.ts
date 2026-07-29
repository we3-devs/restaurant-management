import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateIngredientWastageInput, CreateIngredientWastageItemInput } from "@/lib/validators/ingredient-wastages"

export interface IngredientWastage {
  id: number
  wastageNo: string
  warehouseId: number
  wastageDate: string
  reason: string
  status: "draft" | "approved" | "cancelled"
  remarks: string | null
}

export interface IngredientWastageItem {
  id: number
  ingredientWastageId: number
  ingredientId: number
  quantity: number
  unitCost: number
  totalCost: number
}

export interface ListIngredientWastagesParams {
  page?: number
  limit?: number
  warehouseId?: number
  status?: string
  search?: string
}

export function useIngredientWastages(params: ListIngredientWastagesParams = {}) {
  return useQuery({
    queryKey: queryKeys.ingredientWastages.list(params),
    queryFn: () => apiClient<PaginatedResponse<IngredientWastage>>(`/ingredient-wastages${toQueryString(params)}`),
  })
}

export function useIngredientWastage(id: number) {
  return useQuery({
    queryKey: queryKeys.ingredientWastages.detail(id),
    queryFn: () => apiClient<IngredientWastage>(`/ingredient-wastages/${id}`),
    enabled: id > 0,
  })
}

export function useIngredientWastageItems(id: number) {
  return useQuery({
    queryKey: queryKeys.ingredientWastages.items(id),
    queryFn: () => apiClient<IngredientWastageItem[]>(`/ingredient-wastages/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreateIngredientWastage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIngredientWastageInput) =>
      apiClient<IngredientWastage>("/ingredient-wastages", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredientWastages.lists() }),
  })
}

export function useAddIngredientWastageItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIngredientWastageItemInput) =>
      apiClient<IngredientWastageItem>(`/ingredient-wastages/${id}/items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredientWastages.items(id) }),
  })
}

export function useRemoveIngredientWastageItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      apiClient<void>(`/ingredient-wastages/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredientWastages.items(id) }),
  })
}

export function useApproveIngredientWastage(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<IngredientWastage>(`/ingredient-wastages/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredientWastages.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    },
  })
}

export function useCancelIngredientWastage(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<IngredientWastage>(`/ingredient-wastages/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ingredientWastages.detail(id) }),
  })
}

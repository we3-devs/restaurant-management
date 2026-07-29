import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateStockAdjustmentInput, CreateStockAdjustmentItemInput } from "@/lib/validators/stock-adjustments"

export interface StockAdjustment {
  id: number
  adjustmentNo: string
  warehouseId: number
  adjustmentDate: string
  status: "draft" | "approved" | "cancelled"
  reason: string | null
}

export interface StockAdjustmentItem {
  id: number
  ingredientStockAdjustmentId: number
  ingredientId: number
  systemQuantity: number
  actualQuantity: number
  differenceQuantity: number
  unitCost: number
  differenceValue: number
}

export interface ListStockAdjustmentsParams {
  page?: number
  limit?: number
  warehouseId?: number
  status?: string
  search?: string
}

export function useStockAdjustments(params: ListStockAdjustmentsParams = {}) {
  return useQuery({
    queryKey: queryKeys.stockAdjustments.list(params),
    queryFn: () => apiClient<PaginatedResponse<StockAdjustment>>(`/stock-adjustments${toQueryString(params)}`),
  })
}

export function useStockAdjustment(id: number) {
  return useQuery({
    queryKey: queryKeys.stockAdjustments.detail(id),
    queryFn: () => apiClient<StockAdjustment>(`/stock-adjustments/${id}`),
    enabled: id > 0,
  })
}

export function useStockAdjustmentItems(id: number) {
  return useQuery({
    queryKey: queryKeys.stockAdjustments.items(id),
    queryFn: () => apiClient<StockAdjustmentItem[]>(`/stock-adjustments/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreateStockAdjustment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockAdjustmentInput) =>
      apiClient<StockAdjustment>("/stock-adjustments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockAdjustments.lists() }),
  })
}

export function useAddStockAdjustmentItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockAdjustmentItemInput) =>
      apiClient<StockAdjustmentItem>(`/stock-adjustments/${id}/items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockAdjustments.items(id) }),
  })
}

export function useRemoveStockAdjustmentItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      apiClient<void>(`/stock-adjustments/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockAdjustments.items(id) }),
  })
}

export function useApproveStockAdjustment(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockAdjustment>(`/stock-adjustments/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAdjustments.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    },
  })
}

export function useCancelStockAdjustment(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockAdjustment>(`/stock-adjustments/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockAdjustments.detail(id) }),
  })
}

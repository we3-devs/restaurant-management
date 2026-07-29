import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateStockCountInput, CreateStockCountItemInput } from "@/lib/validators/stock-counts"

export interface StockCount {
  id: number
  countNo: string
  warehouseId: number
  countDate: string
  status: "draft" | "completed" | "adjusted" | "cancelled"
  remarks: string | null
}

export interface StockCountItem {
  id: number
  ingredientStockCountId: number
  ingredientId: number
  systemQuantity: number
  countedQuantity: number
  differenceQuantity: number
  unitCost: number
  differenceValue: number
}

export interface ListStockCountsParams {
  page?: number
  limit?: number
  warehouseId?: number
  status?: string
  search?: string
}

export function useStockCounts(params: ListStockCountsParams = {}) {
  return useQuery({
    queryKey: queryKeys.stockCounts.list(params),
    queryFn: () => apiClient<PaginatedResponse<StockCount>>(`/stock-counts${toQueryString(params)}`),
  })
}

export function useStockCount(id: number) {
  return useQuery({
    queryKey: queryKeys.stockCounts.detail(id),
    queryFn: () => apiClient<StockCount>(`/stock-counts/${id}`),
    enabled: id > 0,
  })
}

export function useStockCountItems(id: number) {
  return useQuery({
    queryKey: queryKeys.stockCounts.items(id),
    queryFn: () => apiClient<StockCountItem[]>(`/stock-counts/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreateStockCount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockCountInput) =>
      apiClient<StockCount>("/stock-counts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.lists() }),
  })
}

export function useAddStockCountItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockCountItemInput) =>
      apiClient<StockCountItem>(`/stock-counts/${id}/items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.items(id) }),
  })
}

export function useRemoveStockCountItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => apiClient<void>(`/stock-counts/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.items(id) }),
  })
}

export function useCompleteStockCount(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockCount>(`/stock-counts/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.items(id) })
    },
  })
}

export function usePostStockCountAdjustments(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockCount>(`/stock-counts/${id}/adjust`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.items(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    },
  })
}

export function useCancelStockCount(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockCount>(`/stock-counts/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockCounts.detail(id) }),
  })
}
